import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { suite, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));

/** Every TypeScript file under the source root, by absolute path. */
const sourceFiles = (): string[] =>
	readdirSync(SOURCE_ROOT, { encoding: 'utf8', recursive: true })
		.filter((path) => path.endsWith('.ts'))
		.map((path) => join(SOURCE_ROOT, path));

const isWithin = (directory: string, path: string): boolean =>
	path === directory || path.startsWith(`${directory}${sep}`);

/** The file each relative import or re-export in `source` names, its `.js` read as the `.ts` it is built from. */
const importedFilesOf = (importer: string, source: string): { specifier: string; target: string }[] =>
	[...source.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g)].map(([, specifier = '']) => ({
		specifier,
		target: resolve(dirname(importer), specifier.replace(/\.js$/, '.ts')),
	}));

/**
 * Why `importer` may not import `target`: a source file importing the index of a module it lies in, which
 * closes a cycle, or any file reaching past the index of a module it lies outside. A test may import the
 * index of its own module, since nothing imports a test.
 */
const importProblemOf = (
	modules: readonly string[],
	{ importer, specifier, target }: { importer: string; specifier: string; target: string },
): string | undefined => {
	const where = `${relative(SOURCE_ROOT, importer)} imports '${specifier}'`;
	const isOwnIndex = basename(target) === 'index.ts' && isWithin(dirname(target), dirname(importer));
	const [outermostEntered] = modules
		.filter((module) => isWithin(module, dirname(target)) && !isWithin(module, dirname(importer)))
		.toSorted((first, second) => first.length - second.length);

	if (isOwnIndex) {
		return importer.endsWith('.test.ts') ? undefined : `${where}, the index of a module it lies in`;
	}

	return outermostEntered === undefined || target === join(outermostEntered, 'index.ts')
		? undefined
		: `${where}, past the index of ${relative(SOURCE_ROOT, outermostEntered) || 'the source root'}`;
};

suite("the adapter's public surface", () => {
	test('exports exactly these runtime values', async () => {
		assert.deepEqual(Object.keys(await import('./index.js')).toSorted(), [
			'ACCESS_CONTROL_EVENTS',
			'UNAVAILABLE_ANSWER',
			'createBridgeLogger',
			'createUsherAccessControl',
			'requesterOf',
		]);
	});
});

suite("the adapter's import paths", () => {
	test('reach another module only through its index, and a source file never through its own', () => {
		// Given every file under the source root, and the modules: each directory holding an index.ts
		const files = sourceFiles();
		const modules = files.filter((file) => basename(file) === 'index.ts').map((file) => dirname(file));

		// When each relative import is held to the module boundaries
		const problems = files.flatMap((importer) =>
			importedFilesOf(importer, readFileSync(importer, 'utf8')).flatMap(({ specifier, target }) => {
				const problem = importProblemOf(modules, { importer, specifier, target });
				return problem === undefined ? [] : [problem];
			}),
		);

		// Then none crosses one
		assert.deepEqual(problems, []);
	});
});
