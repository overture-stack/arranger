import assert from 'node:assert/strict';
import path from 'node:path';
import { suite, test } from 'node:test';

import { resolveConfigsLocation } from './configsLocation.js';

const START = path.resolve('/app');
const VERSION_3_BASE = path.join(START, 'modules', 'server');

/** A filesystem holding exactly the given directories. */
const existingOnly =
	(...directories: string[]) =>
	(candidate: string): boolean =>
		directories.includes(candidate);

suite('resolveConfigsLocation', () => {
	test('resolves a relative path from the start directory where it names a directory there, with no notice', () => {
		const location = resolveConfigsLocation({
			catalogueConfigsPath: './configs',
			currentDirectory: START,
			exists: existingOnly(path.join(START, 'configs'), path.join(VERSION_3_BASE, 'configs')),
		});

		assert.deepEqual(location, { currentDirectory: START });
	});

	test('resolves it from where 3.0 did when only that directory exists, with one deprecation notice', () => {
		// Given a deployment laid out for 3.0, its configuration under modules/server and nothing at the 3.1 location
		const location = resolveConfigsLocation({
			catalogueConfigsPath: './configs',
			currentDirectory: START,
			exists: existingOnly(path.join(VERSION_3_BASE, 'configs')),
		});

		// Then the path resolves from 3.0's base, and the notice names both locations and the guide's section
		assert.equal(location.currentDirectory, VERSION_3_BASE);
		assert.equal(location.notice?.code, 'ARRANGER_CONFIGS_LOCATION');
		const message = location.notice?.message ?? '';
		assert.ok(message.includes(path.join(VERSION_3_BASE, 'configs')), message);
		assert.ok(message.includes(path.join(START, 'configs')), message);
		assert.match(message, /deprecated/);
		assert.match(message, /#configs-directory$/);
	});

	test('names no version or time at which the fallback goes', () => {
		const { notice } = resolveConfigsLocation({
			catalogueConfigsPath: './configs',
			currentDirectory: START,
			exists: existingOnly(path.join(VERSION_3_BASE, 'configs')),
		});

		assert.doesNotMatch(notice?.message ?? '', /removed|until|future|Arranger \d/);
	});

	test('falls back for any relative path, as the CONFIG_PATH alias can set one', () => {
		const location = resolveConfigsLocation({
			catalogueConfigsPath: 'catalogue-configs',
			currentDirectory: START,
			exists: existingOnly(path.join(VERSION_3_BASE, 'catalogue-configs')),
		});

		assert.equal(location.currentDirectory, VERSION_3_BASE);
	});

	test('never falls back for an absolute path, even one that names no directory', () => {
		const location = resolveConfigsLocation({
			catalogueConfigsPath: '/srv/configs',
			currentDirectory: START,
			exists: existingOnly(path.join(VERSION_3_BASE, 'srv', 'configs'), path.join(VERSION_3_BASE, 'configs')),
		});

		assert.deepEqual(location, { currentDirectory: START });
	});

	test('keeps the start directory, with no notice, when the path names a directory in neither place', () => {
		const location = resolveConfigsLocation({
			catalogueConfigsPath: './configs',
			currentDirectory: START,
			exists: existingOnly(),
		});

		assert.deepEqual(location, { currentDirectory: START });
	});
});
