import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, mock, suite, test } from 'node:test';

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

	suite('a configuration directory laid out for 3.0', () => {
		/** A start directory holding `base.json` with `documentType` under each of `relativeDirectories`. */
		const startDirectoryWith = (...layouts: [relativeDirectory: string, documentType: string][]) => {
			const root = makeDir();
			layouts.forEach(([relativeDirectory, documentType]) => {
				fs.mkdirSync(path.join(root, relativeDirectory), { recursive: true });
				writeJson(path.join(root, relativeDirectory), 'base.json', JSON.stringify({ documentType }));
			});
			return root;
		};

		const documentTypesOf = (result: Awaited<ReturnType<typeof loadAllConfigs>>) =>
			Object.values(result.catalogs ?? {}).map(
				(catalogue) => (catalogue as { documentType?: string }).documentType,
			);

		test('is read from where 3.0 resolved it, with one deprecation warning, when the 3.1 location is missing', async () => {
			// Given configuration only under modules/server, where 3.0 resolved ./configs
			const root = startDirectoryWith([path.join('modules', 'server', 'configs'), 'from-3.0-location']);
			const emitWarning = mock.method(process, 'emitWarning', () => undefined);

			// When the configuration loads with the default relative path
			const result = await loadAllConfigs({ catalogueConfigsPath: './configs', currentDirectory: root });
			emitWarning.mock.restore();

			// Then the catalogue comes from there, and one deprecation warning says so under its code
			assert.deepEqual(documentTypesOf(result), ['from-3.0-location']);
			const codes = emitWarning.mock.calls.map(
				(call) => (call.arguments[1] as { code?: string } | undefined)?.code,
			);
			assert.deepEqual(codes, ['ARRANGER_CONFIGS_LOCATION']);
		});

		test('is ignored, with no warning, where the 3.1 location exists', async () => {
			const root = startDirectoryWith(
				['configs', 'from-3.1-location'],
				[path.join('modules', 'server', 'configs'), 'from-3.0-location'],
			);
			const emitWarning = mock.method(process, 'emitWarning', () => undefined);

			const result = await loadAllConfigs({ catalogueConfigsPath: './configs', currentDirectory: root });
			emitWarning.mock.restore();

			assert.deepEqual(documentTypesOf(result), ['from-3.1-location']);
			assert.equal(emitWarning.mock.callCount(), 0);
		});
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
