import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { tableDefaults } from '@overture-stack/arranger-types/configs/constants';
import Parallel from 'paralleljs';

import { applyResultsWindow, hitsToEdges } from './resolveHits.js';

suite('applyResultsWindow', () => {
	test('returns first when it is within the configured results window', () => {
		assert.equal(applyResultsWindow(100, 10000), 100);
	});

	test('caps at maxResultsWindow when first exceeds it', () => {
		assert.equal(applyResultsWindow(20000, 10000), 10000);
	});

	test('respects a per-catalogue window smaller than the requested size', () => {
		assert.equal(applyResultsWindow(1000, 500), 500);
	});

	test('falls back to tableDefaults.MAX_RESULTS_WINDOW when maxResultsWindow is undefined', () => {
		assert.equal(applyResultsWindow(5000, undefined), 5000);
		assert.equal(applyResultsWindow(20000, undefined), tableDefaults.MAX_RESULTS_WINDOW);
	});

	test('returns 0 when first is 0', () => {
		assert.equal(applyResultsWindow(0, 10000), 0);
	});
});

suite('hitsToEdges graphqlNameByPath', () => {
	test('renames a hit field to its sanitized GraphQL name, at the top level and nested', async () => {
		const hits = {
			hits: [
				{
					_id: 'donor1',
					_source: {
						'ca19-9_level': '5',
						biomarker: { 'pd-l1_status': 'Positive' },
					},
				},
			],
		};

		const edges = await hitsToEdges({
			graphqlNameByPath: {
				'ca19-9_level': 'ca19_9_level',
				'biomarker.pd-l1_status': 'pd_l1_status',
			},
			hits,
			nestedFieldNames: [],
			Parallel,
		});

		const { node } = edges[0];
		assert.equal(node.ca19_9_level, '5');
		assert.equal(node.biomarker.pd_l1_status, 'Positive');
	});

	test('leaves hit fields unchanged when no sanitized name is given for them (default behaviour)', async () => {
		const hits = { hits: [{ _id: 'donor1', _source: { donor_id: '5' } }] };

		const edges = await hitsToEdges({ hits, nestedFieldNames: [], Parallel });

		assert.equal(edges[0].node.donor_id, '5');
	});
});
