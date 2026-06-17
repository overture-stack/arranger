import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { tableDefaults, tableProperties } from '@overture-stack/arranger-types/configs/constants';

import fallbackCatalogConfigs from '#config/constants.js';
import { mergeConfigs } from './router.js';

suite('mergeConfigs', () => {
	test('preserves all fallback properties when custom config is empty', () => {
		const result = mergeConfigs(fallbackCatalogConfigs, {});

		assert.deepEqual(result, fallbackCatalogConfigs);
	});

	test('custom top-level value overrides fallback', () => {
		const custom = { esHost: 'http://custom:9200' };

		const result = mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(result.esHost, 'http://custom:9200');
	});

	test('partial sub-object in custom does not drop sibling fallback properties', () => {
		const custom = {
			table: {
				[tableProperties.MAX_RESULTS_WINDOW]: 5000,
			},
		};

		const result = mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(result.table?.[tableProperties.MAX_RESULTS_WINDOW], 5000);
		assert.equal(result.table?.[tableProperties.ROW_ID_FIELD_NAME], tableDefaults.ROW_ID_FIELD_NAME);
	});

	test('custom sub-object value overrides fallback sub-object value', () => {
		const custom = {
			table: {
				[tableProperties.ROW_ID_FIELD_NAME]: 'analysis__analysis_id',
			},
		};

		const result = mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(result.table?.[tableProperties.ROW_ID_FIELD_NAME], 'analysis__analysis_id');
		assert.equal(result.table?.[tableProperties.MAX_RESULTS_WINDOW], tableDefaults.MAX_RESULTS_WINDOW);
	});

	test('does not mutate the fallback input', () => {
		const fallback = { esHost: 'http://original:9200', table: { [tableProperties.MAX_RESULTS_WINDOW]: 10000 } };
		const custom = { esHost: 'http://custom:9200' };

		mergeConfigs(fallback, custom);

		assert.equal(fallback.esHost, 'http://original:9200');
	});

	test('does not mutate the custom input', () => {
		const custom = { table: { [tableProperties.MAX_RESULTS_WINDOW]: 5000 } };

		mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(custom.table[tableProperties.MAX_RESULTS_WINDOW], 5000);
		assert.equal((custom.table as Record<string, unknown>)[tableProperties.ROW_ID_FIELD_NAME], undefined);
	});
});
