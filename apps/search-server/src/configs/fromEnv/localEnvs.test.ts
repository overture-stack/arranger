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

/** Writes the whole configuration the module read, for the renamed-variable scenarios. */
const CONFIGS_CHILD_SOURCE = String.raw`
const { localEnvsUrl, resultMarker } = JSON.parse(process.argv.at(-1));
const { default: configsFromEnv } = await import(localEnvsUrl);
process.stdout.write(resultMarker + JSON.stringify(configsFromEnv) + '\n', () => process.exit(0));
`;

type ConfigsRead = {
	configs: {
		catalogueConfigsPath?: string;
		catalogs: {
			fromEnv: { downloads: { allowCustomMaxRows?: boolean; maxRows?: number }; sets: { index?: string } };
		};
		enableAdmin?: boolean;
		enableDebug?: boolean;
		serverPort?: number;
	};
	/** What the process wrote to stderr, where Node prints deprecation warnings. */
	errorOutput: string;
};

const readConfigs = (environment: Record<string, string>): Promise<ConfigsRead> =>
	new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[
				'--import',
				tsxLoaderUrl,
				'--input-type=module',
				'--eval',
				CONFIGS_CHILD_SOURCE,
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
				resolve({ configs: JSON.parse(resultLine.slice(RESULT_MARKER.length)), errorOutput });
			} else {
				reject(new Error(`the configuration module reported no result\n${errorOutput}`));
			}
		});
	});

const deprecationWarnings = ({ errorOutput }: ConfigsRead): string[] =>
	errorOutput.split('\n').filter((line) => line.includes('DeprecationWarning'));

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

suite('search-server image: environment variables renamed in 3.1', { concurrency: 3 }, () => {
	test('reads a 3.0 name as its 3.1 name, printing one deprecation warning for each', async () => {
		// Given an image started with a 3.0 deployment's variable names
		const read = await readConfigs({
			CONFIG_PATH: '/srv/catalogues',
			DEBUG: 'true',
			ES_ARRANGER_SET_INDEX: 'saved-sets',
			PORT: '6060',
		});

		// Then each value reaches the configuration under its new name
		assert.equal(read.configs.catalogueConfigsPath, '/srv/catalogues', read.errorOutput);
		assert.equal(read.configs.enableDebug, true);
		assert.equal(read.configs.catalogs.fromEnv.sets.index, 'saved-sets');
		assert.equal(read.configs.serverPort, 6060);

		// And Node printed one deprecation warning per variable, under the renamed-variable code
		const warnings = deprecationWarnings(read);
		assert.equal(warnings.length, 4, read.errorOutput);
		assert.ok(
			warnings.every((warning) => warning.includes('[ARRANGER_ENV_RENAMED]')),
			read.errorOutput,
		);
	});

	test('reads a 3.0 value as 3.0 read it, so a value 3.0 took as the default changes nothing', async () => {
		// Given values 3.0 read as each variable's default: a flag other than `true`, and a port of 0
		const read = await readConfigs({ ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS: '1', DEBUG: '1', PORT: '0' });

		// Then 3.1 reads the same defaults
		assert.equal(read.configs.catalogs.fromEnv.downloads.allowCustomMaxRows, false, read.errorOutput);
		assert.equal(read.configs.enableDebug, false);
		assert.equal(read.configs.serverPort, 5050);
	});

	test('keeps the 3.1 value when both names are set, warning that the 3.0 name was ignored', async () => {
		const read = await readConfigs({ PORT: '7070', SERVER_PORT: '6060' });

		assert.equal(read.configs.serverPort, 6060, read.errorOutput);
		assert.deepEqual(
			deprecationWarnings(read).map((warning) => warning.includes('PORT is ignored')),
			[true],
			read.errorOutput,
		);
	});

	test('warns that a variable no longer read has no effect', async () => {
		const read = await readConfigs({ ES_LOG: 'error' });

		assert.deepEqual(
			deprecationWarnings(read).map((warning) => warning.includes('[ARRANGER_ENV_UNREAD]')),
			[true],
			read.errorOutput,
		);
	});

	test('prints no deprecation warning for an image started with 3.1 names only', async () => {
		const read = await readConfigs({ CONFIGS_PATH: '/srv/catalogues', ENABLE_DEBUG: 'true', SERVER_PORT: '6060' });

		assert.equal(read.configs.serverPort, 6060, read.errorOutput);
		assert.deepEqual(deprecationWarnings(read), [], read.errorOutput);
	});
});

suite('search-server image: MAX_DOWNLOAD_ROWS, the row limit 3.0 never applied', () => {
	test('leaves the row limit at its default, as 3.0 applied none, and warns that it has no effect', async () => {
		// Given an image started with a 3.0 environment copied from its schema, and one setting nothing
		const [read, unset] = await Promise.all([readConfigs({ MAX_DOWNLOAD_ROWS: '100' }), readConfigs({})]);

		// Then the limit is the one set when nothing is, and one warning says the variable has no effect
		assert.equal(
			read.configs.catalogs.fromEnv.downloads.maxRows,
			unset.configs.catalogs.fromEnv.downloads.maxRows,
			read.errorOutput,
		);
		assert.deepEqual(
			deprecationWarnings(read).map((warning) => warning.includes('[ARRANGER_ENV_UNREAD]')),
			[true],
			read.errorOutput,
		);
	});
});

suite('search-server image: the export row limit', () => {
	test('reads an unset DOWNLOAD_MAX_ROWS as no limit, as 3.0 applied none', async () => {
		const read = await readConfigs({});

		assert.equal(read.configs.catalogs.fromEnv.downloads.maxRows, 0, read.errorOutput);
	});

	test('keeps an explicit DOWNLOAD_MAX_ROWS, 0 included', async () => {
		const [hundred, zero] = await Promise.all([
			readConfigs({ DOWNLOAD_MAX_ROWS: '100' }),
			readConfigs({ DOWNLOAD_MAX_ROWS: '0' }),
		]);

		assert.equal(hundred.configs.catalogs.fromEnv.downloads.maxRows, 100, hundred.errorOutput);
		assert.equal(zero.configs.catalogs.fromEnv.downloads.maxRows, 0, zero.errorOutput);
	});

	test('reads an unset DOWNLOAD_MAX_ROWS as 100 rows with access control on, and as no limit with it off', async () => {
		// Given an image with no row limit set, its access control on in either spelling, or off
		const [enabled, enabledAsOne, disabled] = await Promise.all([
			readConfigs({ ENABLE_ACCESS_CONTROL: 'true' }),
			readConfigs({ ENABLE_ACCESS_CONTROL: '1' }),
			readConfigs({ ENABLE_ACCESS_CONTROL: 'false' }),
		]);

		// Then access control bounds an export by default, and its absence leaves 3.0's unbounded default
		assert.equal(enabled.configs.catalogs.fromEnv.downloads.maxRows, 100, enabled.errorOutput);
		assert.equal(enabledAsOne.configs.catalogs.fromEnv.downloads.maxRows, 100, enabledAsOne.errorOutput);
		assert.equal(disabled.configs.catalogs.fromEnv.downloads.maxRows, 0, disabled.errorOutput);
	});

	test('keeps an explicit DOWNLOAD_MAX_ROWS with access control on, 0 meaning every row', async () => {
		const [bounded, unbounded] = await Promise.all([
			readConfigs({ DOWNLOAD_MAX_ROWS: '250', ENABLE_ACCESS_CONTROL: 'true' }),
			readConfigs({ DOWNLOAD_MAX_ROWS: '0', ENABLE_ACCESS_CONTROL: 'true' }),
		]);

		assert.equal(bounded.configs.catalogs.fromEnv.downloads.maxRows, 250, bounded.errorOutput);
		assert.equal(unbounded.configs.catalogs.fromEnv.downloads.maxRows, 0, unbounded.errorOutput);
	});
});

suite('search-server image: an ENABLE_ADMIN value 3.0 read as off', () => {
	const ADMIN_NOTICE_CODE = '[ARRANGER_ENV_MEANING_CHANGED]';

	test('turns admin on, as 3.1 reads 1, with exactly one warning that is not a deprecation', async () => {
		// Given an image started with ENABLE_ADMIN=1, which 3.0 read as off
		const read = await readConfigs({ ENABLE_ADMIN: '1' });

		// Then admin is on, and one plain warning, printed once, says 3.0 read the value differently
		const notices = read.errorOutput.split('\n').filter((line) => line.includes(ADMIN_NOTICE_CODE));
		assert.equal(read.configs.enableAdmin, true, read.errorOutput);
		assert.equal(notices.length, 1, read.errorOutput);
		assert.doesNotMatch(notices[0] ?? '', /DeprecationWarning/);
	});

	test('prints nothing for true, which 3.0 and 3.1 both read as on', async () => {
		const read = await readConfigs({ ENABLE_ADMIN: 'true' });

		assert.equal(read.configs.enableAdmin, true, read.errorOutput);
		assert.equal(read.errorOutput.includes(ADMIN_NOTICE_CODE), false, read.errorOutput);
	});
});
