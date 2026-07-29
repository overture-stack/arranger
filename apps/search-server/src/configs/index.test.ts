import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, suite, test } from 'node:test';

import loadAllConfigs from './index.js';

const tempDirs: string[] = [];

const makeDir = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arranger-configs-index-test-'));
	tempDirs.push(dir);
	return dir;
};

const writeJson = (dir: string, filename: string, contents: string) => {
	fs.writeFileSync(path.join(dir, filename), contents, 'utf8');
};

const cleanup = () => {
	while (tempDirs.length) {
		fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
	}
};

afterEach(cleanup);
after(cleanup);

suite('loadAllConfigs', () => {
	test('falls back to env-only config when the configs directory does not exist', async () => {
		const missingDir = path.join(os.tmpdir(), 'arranger-configs-index-test-does-not-exist');

		const result = await loadAllConfigs({
			catalogueConfigsPath: missingDir,
			currentDirectory: '',
		});

		assert.ok(result.catalogs && 'fromEnv' in result.catalogs);
	});

	test('a malformed catalogue directory is skipped, healthy sibling catalogues still register', async () => {
		const root = makeDir();
		fs.mkdirSync(path.join(root, 'healthy'));
		fs.mkdirSync(path.join(root, 'broken'));
		writeJson(root + '/healthy', 'base.json', JSON.stringify({ documentType: 'file' }));
		writeJson(root + '/broken', 'base.json', '{ not valid json');

		const result = await loadAllConfigs({
			catalogueConfigsPath: root,
			currentDirectory: '',
		});

		assert.deepEqual(Object.keys(result.catalogs ?? {}), ['healthy']);
	});

	test('a malformed single-catalogue config fails loudly instead of silently defaulting to env values', async () => {
		const dir = makeDir();
		writeJson(dir, 'base.json', '{ not valid json');

		await assert.rejects(
			loadAllConfigs({
				catalogueConfigsPath: dir,
				currentDirectory: '',
			}),
		);
	});
});
