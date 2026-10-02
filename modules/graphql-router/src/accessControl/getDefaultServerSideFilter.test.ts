import assert from 'node:assert/strict';
import path from 'node:path';
import { suite, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import * as packageRoot from '#index.js';
import compileFilter from '#mapping/utils/compileFilter.js';

import { denyAllFilter } from './serverSideFilters.fixture.js';

const { getDefaultServerSideFilter } = packageRoot;

const PACKAGE_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONSUMER_PATH = path.join(PACKAGE_DIRECTORY, 'src', 'deprecationConsumer.ts');
const RELEASE_DECLARATIONS_DIRECTORY = path.join(PACKAGE_DIRECTORY, '.release-declarations');

/** Every leaf clause in a SQON node, whatever combination shape wraps it. */
const leavesOf = (node: any): any[] =>
	Array.isArray(node?.content) ? node.content.flatMap(leavesOf) : node?.content?.fieldName ? [node] : [];

const compilerOptionsFrom = (configName: string): ts.CompilerOptions => {
	const configPath = path.join(PACKAGE_DIRECTORY, configName);
	const { config } = ts.readConfigFile(configPath, ts.sys.readFile);

	return ts.parseJsonConfigFileContent(config, ts.sys, PACKAGE_DIRECTORY, undefined, configPath).options;
};

/**
 * A consumer importing `getDefaultServerSideFilter` from `moduleSpecifier`, beside a local
 * declaration deprecated on purpose: if the probe reports that one and not the import, the import
 * is genuinely not deprecated, rather than the probe reporting nothing at all.
 */
const consumerImporting = (moduleSpecifier: string): string =>
	[
		`import { getDefaultServerSideFilter } from '${moduleSpecifier}';`,
		'/** @deprecated */',
		'const knownDeprecated = 1;',
		'export const probes = [getDefaultServerSideFilter, knownDeprecated];',
	].join('\n');

/**
 * What a TypeScript editor tells the author of `consumerSource`: its type errors, and the
 * deprecation notices it would strike through. `overlay` holds files that exist only in memory.
 */
const editorFeedbackFor = ({
	consumerSource,
	overlay = new Map(),
}: {
	consumerSource: string;
	overlay?: Map<string, string>;
}): { deprecations: string[]; errors: string[] } => {
	const files = new Map([...overlay, [CONSUMER_PATH, consumerSource]]);
	const readFile = (fileName: string): string | undefined => files.get(fileName) ?? ts.sys.readFile(fileName);
	const overlayDirectories = new Set(
		[...files.keys()].flatMap((fileName) =>
			path
				.dirname(fileName)
				.split(path.sep)
				.map((_segment, index, segments) => segments.slice(0, index + 1).join(path.sep)),
		),
	);
	const options = compilerOptionsFrom('tsconfig.json');

	const service = ts.createLanguageService({
		directoryExists: (directoryName) =>
			overlayDirectories.has(directoryName) || ts.sys.directoryExists(directoryName),
		fileExists: (fileName) => files.has(fileName) || ts.sys.fileExists(fileName),
		getCompilationSettings: () => ({ ...options, noEmit: true }),
		getCurrentDirectory: () => PACKAGE_DIRECTORY,
		getDefaultLibFileName: ts.getDefaultLibFilePath,
		getScriptFileNames: () => [CONSUMER_PATH],
		getScriptSnapshot: (fileName) => {
			const text = readFile(fileName);
			return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
		},
		getScriptVersion: () => '1',
		readFile,
	});

	const messageOf = (diagnostic: ts.Diagnostic): string =>
		ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');

	return {
		deprecations: service
			.getSuggestionDiagnostics(CONSUMER_PATH)
			.filter((diagnostic) => diagnostic.reportsDeprecated)
			.map(messageOf),
		errors: service.getSemanticDiagnostics(CONSUMER_PATH).map(messageOf),
	};
};

/** The declaration files the release build would publish, emitted into memory rather than to disk. */
const releaseDeclarations = (): Map<string, string> => {
	const emitted = new Map<string, string>();

	ts.createProgram({
		options: {
			...compilerOptionsFrom('tsconfig.release.json'),
			declaration: true,
			emitDeclarationOnly: true,
			noEmit: false,
			outDir: RELEASE_DECLARATIONS_DIRECTORY,
		},
		rootNames: [path.join(PACKAGE_DIRECTORY, 'src', 'index.ts')],
	}).emit(undefined, (fileName, text) => emitted.set(fileName, text), undefined, true);

	return emitted;
};

suite('accessControl/getDefaultServerSideFilter, the deprecated alias of includeEverything', () => {
	test('is the same function object as includeEverything', () => {
		// Given both names exported from the package root
		// When they are compared
		// Then they are one function, so the alias cannot drift from what it stands for
		assert.equal(typeof packageRoot.includeEverything, 'function');
		assert.equal(getDefaultServerSideFilter, packageRoot.includeEverything);
	});

	test('carries a leaf clause rather than being an empty combination', () => {
		const filter = getDefaultServerSideFilter({});

		assert.equal(leavesOf(filter).length, 1);
	});

	test('is accepted by compileFilter', () => {
		assert.doesNotThrow(() =>
			compileFilter({ clientSideFilter: undefined, serverSideFilter: getDefaultServerSideFilter({}) }),
		);
	});

	test('still answers the zero-argument call that earlier advice showed', () => {
		// Given an existing caller that followed the advice to call it with no argument
		const call = getDefaultServerSideFilter as unknown as () => unknown;

		// When it calls it that way
		const filter = call();

		// Then it gets the same filter as a call with a context, and compileFilter accepts it
		assert.deepEqual(filter, getDefaultServerSideFilter({}));
		assert.doesNotThrow(() => compileFilter({ clientSideFilter: undefined, serverSideFilter: filter }));
	});

	test('is a different value from a deny-all filter', () => {
		const allowAll = getDefaultServerSideFilter({});
		const denyAll = denyAllFilter('_id')({});

		assert.notDeepEqual(allowAll, denyAll);
	});

	test('negates a match-nothing leaf', () => {
		const filter = getDefaultServerSideFilter({});
		const [leaf] = leavesOf(filter);

		assert.equal(filter.op, 'not');
		assert.equal(leaf.op, 'in');
		assert.deepEqual(leaf.content.value, []);
	});

	test('compileFilter rejects an empty combination', () => {
		assert.throws(
			() => compileFilter({ clientSideFilter: undefined, serverSideFilter: { op: 'and', content: [] } }),
			/empty 'and' combination/,
		);
	});

	test('is reported deprecated to a TypeScript consumer of the package source', () => {
		// Given a consumer importing the alias from the package's own entry point
		// When an editor checks that consumer
		const { deprecations, errors } = editorFeedbackFor({ consumerSource: consumerImporting('./index.js') });

		// Then the import resolves, the probe reports deprecations at all, and the alias is one of them
		assert.deepEqual(errors, []);
		assert.ok(
			deprecations.some((message) => message.includes("'knownDeprecated'")),
			`got ${deprecations}`,
		);
		assert.ok(
			deprecations.some((message) => message.includes("'getDefaultServerSideFilter'")),
			`expected getDefaultServerSideFilter to be reported deprecated, got ${JSON.stringify(deprecations)}`,
		);
	});

	test('stays deprecated in the declarations the release build publishes', () => {
		// Given the declaration files tsconfig.release.json emits, which consumers of the package read
		const declarations = releaseDeclarations();

		// When an editor checks a consumer importing the alias from those declarations
		const { deprecations, errors } = editorFeedbackFor({
			consumerSource: consumerImporting('../.release-declarations/index.js'),
			overlay: declarations,
		});

		// Then the deprecation survives the release build rather than being stripped with the comments
		assert.deepEqual(errors, []);
		assert.ok(
			deprecations.some((message) => message.includes("'knownDeprecated'")),
			`got ${deprecations}`,
		);
		assert.ok(
			deprecations.some((message) => message.includes("'getDefaultServerSideFilter'")),
			`expected getDefaultServerSideFilter to be reported deprecated, got ${JSON.stringify(deprecations)}`,
		);
	});
});
