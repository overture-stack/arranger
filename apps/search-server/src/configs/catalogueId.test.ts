import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { resolveCatalogueId } from './catalogueId.js';

suite('resolveCatalogueId', () => {
	test('uses the explicit catalogId from config when set', () => {
		const id = resolveCatalogueId({
			aggregatedConfigs: { catalogId: 'participants' },
			configsPath: '/configs/some-folder',
			usedIds: new Set(),
		});

		assert.equal(id, 'participants');
	});

	test('falls back to the directory name when no explicit catalogId is set', () => {
		const id = resolveCatalogueId({
			aggregatedConfigs: {},
			configsPath: '/configs/biosamples',
			usedIds: new Set(),
		});

		assert.equal(id, 'biosamples');
	});

	test('falls back to a generated id when the directory is named "config" and no explicit catalogId is set', () => {
		const id = resolveCatalogueId({
			aggregatedConfigs: {},
			configsPath: '/some/path/config',
			usedIds: new Set(),
		});

		assert.match(id, /^catalogue-[0-9a-f]{8}$/);
	});

	test('falls back to a generated id when the directory is named "configs" and no explicit catalogId is set', () => {
		const id = resolveCatalogueId({
			aggregatedConfigs: {},
			configsPath: '/some/path/configs',
			usedIds: new Set(),
		});

		assert.match(id, /^catalogue-[0-9a-f]{8}$/);
	});

	test('the generated fallback id is stable for the same configsPath', () => {
		const first = resolveCatalogueId({
			aggregatedConfigs: {},
			configsPath: '/some/path/config',
			usedIds: new Set(),
		});
		const second = resolveCatalogueId({
			aggregatedConfigs: {},
			configsPath: '/some/path/config',
			usedIds: new Set(),
		});

		assert.equal(first, second);
	});

	test('registers the resolved id in usedIds so a later call can detect the collision', () => {
		const usedIds = new Set<string>();

		resolveCatalogueId({ aggregatedConfigs: { catalogId: 'participants' }, configsPath: '/a', usedIds });

		assert.ok(usedIds.has('participants'));
	});

	test('appends a deduping suffix when the resolved id collides with one already in usedIds', () => {
		const usedIds = new Set<string>(['participants']);

		const id = resolveCatalogueId({
			aggregatedConfigs: { catalogId: 'participants' },
			configsPath: '/b',
			usedIds,
		});

		assert.notEqual(id, 'participants');
		assert.match(id, /^participants-[0-9a-f]{8}$/);
		assert.ok(usedIds.has(id));
	});

	test('the deduped id differs per configsPath, so two colliding catalogues don\'t collide with each other too', () => {
		const usedIds = new Set<string>(['participants']);

		const first = resolveCatalogueId({ aggregatedConfigs: { catalogId: 'participants' }, configsPath: '/b', usedIds });
		const second = resolveCatalogueId({ aggregatedConfigs: { catalogId: 'participants' }, configsPath: '/c', usedIds });

		assert.notEqual(first, second);
	});
});
