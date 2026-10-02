import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { suite, test } from 'node:test';

const BOOLEAN_VALUE_IGNORED_EVENT = 'config.boolean_value_ignored';
const CHILD_TIMEOUT_MS = 30_000;
const RESULT_MARKER = '@@local-envs-result@@';

const localEnvsUrl = new URL('./localEnvs.ts', import.meta.url).href;
const tsxLoaderUrl = import.meta.resolve('tsx');

/** Only what a process needs in order to run at all, so a developer's own flags cannot decide these outcomes. */
const inheritedEnvironment = Object.fromEntries(
	['PATH', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR'].flatMap((name) => {
		const value = process.env[name];
		return value === undefined ? [] : [[name, value]];
	}),
);

/**
 * Runs in a fresh process per scenario, because the configuration module reads the environment once,
 * when it is first imported. It reaches the boolean parser through the built types package, as a
 * deployed image does.
 */
const CHILD_SOURCE = String.raw`
const { localEnvsUrl, resultMarker } = JSON.parse(process.argv.at(-1));
const { default: configsFromEnv } = await import(localEnvsUrl);
const result = JSON.stringify(configsFromEnv.catalogs.fromEnv.disableGraphQLIntrospection);
process.stdout.write(resultMarker + result + '\n', () => process.exit(0));
`;

type IntrospectionRead = {
	disableGraphQLIntrospection: unknown;
	/** What the process wrote to stderr, where the boolean parser warns. */
	errorOutput: string;
};

const readIntrospectionFlag = (environment: Record<string, string>): Promise<IntrospectionRead> =>
	new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[
				'--import',
				tsxLoaderUrl,
				'--input-type=module',
				'--eval',
				CHILD_SOURCE,
				JSON.stringify({ localEnvsUrl, resultMarker: RESULT_MARKER }),
			],
			{ cwd: os.tmpdir(), env: { ...inheritedEnvironment, ...environment } },
		);

		const outputChunks: string[] = [];
		const errorChunks: string[] = [];
		child.stdout.setEncoding('utf8').on('data', (chunk: string) => outputChunks.push(chunk));
		child.stderr.setEncoding('utf8').on('data', (chunk: string) => errorChunks.push(chunk));

		const killTimer = setTimeout(() => child.kill('SIGKILL'), CHILD_TIMEOUT_MS);
		child.on('close', () => {
			clearTimeout(killTimer);
			const errorOutput = errorChunks.join('');
			const resultLine = outputChunks
				.join('')
				.split('\n')
				.find((line) => line.startsWith(RESULT_MARKER));

			if (resultLine) {
				resolve({
					disableGraphQLIntrospection: JSON.parse(resultLine.slice(RESULT_MARKER.length)),
					errorOutput,
				});
			} else {
				reject(new Error(`the configuration module reported no result\n${errorOutput}`));
			}
		});
	});

const ignoredValueWarnings = ({ errorOutput }: IntrospectionRead): string[] =>
	errorOutput.split('\n').filter((line) => line.includes(BOOLEAN_VALUE_IGNORED_EVENT));

suite('search-server image: DISABLE_GRAPHQL_INTROSPECTION', { concurrency: 4 }, () => {
	['yes', 'no'].forEach((rawValue) => {
		const label = JSON.stringify(rawValue);

		test(`keeps introspection disabled in production given ${label}, a value the boolean rule ignores, and warns naming it`, async () => {
			const read = await readIntrospectionFlag({
				DISABLE_GRAPHQL_INTROSPECTION: rawValue,
				NODE_ENV: 'production',
			});

			assert.equal(read.disableGraphQLIntrospection, true, read.errorOutput);
			assert.deepEqual(
				ignoredValueWarnings(read).map((warning) => warning.includes(label)),
				[true],
				read.errorOutput,
			);
		});

		test(`leaves introspection enabled outside production given ${label}, since that is the default there`, async () => {
			const read = await readIntrospectionFlag({
				DISABLE_GRAPHQL_INTROSPECTION: rawValue,
				NODE_ENV: 'development',
			});

			assert.equal(read.disableGraphQLIntrospection, false, read.errorOutput);
			assert.equal(ignoredValueWarnings(read).length, 1, read.errorOutput);
		});
	});

	test('honours an accepted value over the default, in production and outside it, without a warning', async () => {
		const [productionFalse, developmentTrue] = await Promise.all([
			readIntrospectionFlag({ DISABLE_GRAPHQL_INTROSPECTION: 'false', NODE_ENV: 'production' }),
			readIntrospectionFlag({ DISABLE_GRAPHQL_INTROSPECTION: '1', NODE_ENV: 'development' }),
		]);

		assert.equal(productionFalse.disableGraphQLIntrospection, false, productionFalse.errorOutput);
		assert.equal(developmentTrue.disableGraphQLIntrospection, true, developmentTrue.errorOutput);
		[productionFalse, developmentTrue].forEach((read) => {
			assert.deepEqual(ignoredValueWarnings(read), [], read.errorOutput);
		});
	});

	test('keeps introspection disabled in production, without a warning, when the variable is unset', async () => {
		const read = await readIntrospectionFlag({ NODE_ENV: 'production' });

		assert.equal(read.disableGraphQLIntrospection, true, read.errorOutput);
		assert.deepEqual(ignoredValueWarnings(read), [], read.errorOutput);
	});
});
