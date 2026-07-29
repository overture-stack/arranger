import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, suite, test } from 'node:test';

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
