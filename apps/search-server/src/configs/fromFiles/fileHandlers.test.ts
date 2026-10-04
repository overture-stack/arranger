import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, mock, suite, test } from 'node:test';

import getConfigFromFiles from './fileHandlers.js';

const tempDirs: string[] = [];

const makeConfigDir = (files: Record<string, string> = {}) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arranger-fileHandlers-test-'));
	tempDirs.push(dir);

	for (const [filename, contents] of Object.entries(files)) {
		fs.writeFileSync(path.join(dir, filename), contents, 'utf8');
	}

	return dir;
};

afterEach(() => {
	// each test creates at most one directory; clear the accumulator so a later
	// suite-level `after` doesn't try to remove a directory more than once
	while (tempDirs.length) {
		fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
	}
});

after(() => {
	while (tempDirs.length) {
		fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
	}
});

suite('getConfigFromFiles', () => {
	test('returns the base config when the directory does not exist', async () => {
		const missingDir = path.join(os.tmpdir(), 'arranger-fileHandlers-test-does-not-exist');

		const [, aggregatedConfigs] = await getConfigFromFiles({
			baseConfig: { documentType: 'file' },
			catalogueConfigsPath: missingDir,
			currentDirectory: '',
			enableDebug: false,
		});

		assert.deepEqual(aggregatedConfigs, { documentType: 'file' });
	});

	test('returns the base config when the directory has no json files', async () => {
		const dir = makeConfigDir({ 'README.md': 'not a config file' });

		const [, aggregatedConfigs] = await getConfigFromFiles({
			baseConfig: { documentType: 'file' },
			catalogueConfigsPath: dir,
			currentDirectory: '',
			enableDebug: false,
		});

		assert.deepEqual(aggregatedConfigs, { documentType: 'file' });
	});

	test('merges valid json files into the base config', async () => {
		const dir = makeConfigDir({
			'base.json': JSON.stringify({ documentType: 'file' }),
			'extended.json': JSON.stringify({ extended: [{ fieldName: 'donor.id' }] }),
		});

		const [configsPath, aggregatedConfigs] = await getConfigFromFiles({
			baseConfig: {},
			catalogueConfigsPath: dir,
			currentDirectory: '',
			enableDebug: false,
		});

		assert.equal(configsPath, dir);
		assert.equal(aggregatedConfigs.documentType, 'file');
		assert.deepEqual(aggregatedConfigs.extended, [{ fieldName: 'donor.id' }]);
	});

	test('rejects instead of silently falling back to the base config when a json file is malformed', async () => {
		const dir = makeConfigDir({
			'base.json': '{ this is not valid json',
		});

		await assert.rejects(
			getConfigFromFiles({
				baseConfig: { documentType: 'file' },
				catalogueConfigsPath: dir,
				currentDirectory: '',
				enableDebug: false,
			}),
		);
	});

	test('malformed json failure message identifies which file is broken', async () => {
		const dir = makeConfigDir({
			'extended.json': '{ this is not valid json',
		});

		await assert.rejects(
			getConfigFromFiles({
				baseConfig: {},
				catalogueConfigsPath: dir,
				currentDirectory: '',
				enableDebug: false,
			}),
			(err: Error) => {
				assert.match(err.message, /extended/);
				return true;
			},
		);
	});

	test('a valid file is not discarded by an unrelated malformed file elsewhere in the same directory', async () => {
		// documents current, unfixed behaviour: one bad file invalidates the whole
		// directory's config rather than only the file that failed to parse.
		const dir = makeConfigDir({
			'base.json': JSON.stringify({ documentType: 'file' }),
			'extended.json': '{ not valid json',
		});

		await assert.rejects(
			getConfigFromFiles({
				baseConfig: {},
				catalogueConfigsPath: dir,
				currentDirectory: '',
				enableDebug: false,
			}),
		);
	});
});

suite('getConfigFromFiles reading the 3.0 "index" key', () => {
	/** Loads `files`, over `baseConfig`, returning the configuration and the warnings emitted. */
	const loadWith = async (files: Record<string, unknown>, baseConfig: Record<string, unknown> = {}) => {
		const dir = makeConfigDir(
			Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, JSON.stringify(contents)])),
		);
		const emitWarning = mock.method(process, 'emitWarning', () => undefined);
		const [, aggregatedConfigs] = await getConfigFromFiles({
			baseConfig,
			catalogueConfigsPath: dir,
			currentDirectory: '',
			enableDebug: false,
		});
		emitWarning.mock.restore();

		return {
			configs: aggregatedConfigs as Record<string, unknown>,
			warnings: emitWarning.mock.calls.map((call) => ({
				code: (call.arguments[1] as { code?: string } | undefined)?.code,
				message: String(call.arguments[0]),
			})),
		};
	};

	test('reads a file\'s "index" as esIndex, with one deprecation warning naming the new key and the guide', async () => {
		// Given a 3.0 base.json naming its index with the 3.0 key
		const { configs, warnings } = await loadWith({ 'base.json': { documentType: 'file', index: 'legacy-index' } });

		// Then the index reaches the configuration as esIndex, and one warning says so
		assert.equal(configs.esIndex, 'legacy-index');
		assert.equal(configs.index, undefined);
		assert.deepEqual(
			warnings.map(({ code }) => code),
			['ARRANGER_CONFIG_RENAMED'],
		);
		assert.match(warnings[0]?.message ?? '', /"index" is deprecated: name it "esIndex" instead/);
		assert.match(warnings[0]?.message ?? '', /#config-index-key$/);
		assert.doesNotMatch(warnings[0]?.message ?? '', /removed|until|future/);
	});

	test('lets a file\'s "index" override the environment\'s index, as 3.0 let a file override ES_INDEX', async () => {
		const { configs } = await loadWith({ 'base.json': { index: 'from-file' } }, { esIndex: 'from-environment' });

		assert.equal(configs.esIndex, 'from-file');
	});

	test('keeps esIndex where a file sets both, warning that "index" was ignored', async () => {
		const { configs, warnings } = await loadWith({ 'base.json': { esIndex: 'new-index', index: 'old-index' } });

		assert.equal(configs.esIndex, 'new-index');
		assert.equal(warnings.length, 1);
		assert.match(warnings[0]?.message ?? '', /"index" is ignored because "esIndex" is also set/);
	});

	test('prints nothing for a configuration naming esIndex only', async () => {
		const { configs, warnings } = await loadWith({ 'base.json': { esIndex: 'new-index' } });

		assert.equal(configs.esIndex, 'new-index');
		assert.deepEqual(warnings, []);
	});
});
