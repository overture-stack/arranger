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

		const { results } = await hitsToEdges({
			graphqlNameByPath: {
				'ca19-9_level': 'ca19_9_level',
				'biomarker.pd-l1_status': 'pd_l1_status',
			},
			hits,
			nestedFieldNames: [],
			Parallel,
		});

		const { node } = results[0];
		assert.equal(node.ca19_9_level, '5');
		assert.equal(node.biomarker.pd_l1_status, 'Positive');
	});

	test('leaves hit fields unchanged when no sanitized name is given for them (default behaviour)', async () => {
		const hits = { hits: [{ _id: 'donor1', _source: { donor_id: '5' } }] };

		const { results } = await hitsToEdges({ hits, nestedFieldNames: [], Parallel });

		assert.equal(results[0].node.donor_id, '5');
	});
});

suite('hitsToEdges array-without-isArray coercion', () => {
	test('coerces a multi-value field to its first element and reports a warning when isArray is not configured', async () => {
		const hits = {
			hits: [{ _id: 'donor1', _source: { genetic_disorders: ['Juvenile Polyposis Syndrome', 'Lynch Syndrome'] } }],
		};

		const { results, warnings } = await hitsToEdges({ hits, nestedFieldNames: [], Parallel });

		assert.equal(results[0].node.genetic_disorders, 'Juvenile Polyposis Syndrome');
		assert.equal(warnings.length, 1);
		assert.equal(warnings[0].field, 'genetic_disorders');
		assert.equal(warnings[0].fullPath, 'genetic_disorders');
		assert.equal(warnings[0].valueCount, 2);
	});

	test('leaves a single-value array unchanged in content but still reports no warning (nothing was actually dropped)', async () => {
		const hits = { hits: [{ _id: 'donor1', _source: { genetic_disorders: ['Juvenile Polyposis Syndrome'] } }] };

		const { results, warnings } = await hitsToEdges({ hits, nestedFieldNames: [], Parallel });

		assert.equal(results[0].node.genetic_disorders, 'Juvenile Polyposis Syndrome');
		assert.equal(warnings.length, 0);
	});

	test('leaves a field explicitly configured with isArray as a full array, unwarned', async () => {
		const hits = {
			hits: [{ _id: 'donor1', _source: { genetic_disorders: ['Juvenile Polyposis Syndrome', 'Lynch Syndrome'] } }],
		};

		const { results, warnings } = await hitsToEdges({
			extendedFields: [{ fieldName: 'genetic_disorders', isArray: true }],
			hits,
			nestedFieldNames: [],
			Parallel,
		});

		assert.deepEqual(results[0].node.genetic_disorders, ['Juvenile Polyposis Syndrome', 'Lynch Syndrome']);
		assert.equal(warnings.length, 0);
	});

	test('skips the nestingPrefix envelope key left behind by unwrapSource, instead of warning about it twice', async () => {
		// unwrapSource merges the envelope's contents onto the top level but leaves the envelope
		// key itself in place; this is what a hit's `_source` actually looks like afterward.
		const hits = {
			hits: [
				{
					_id: 'donor1',
					_source: {
						data: { sample_registrations: ['a', 'b'] },
						sample_registrations: ['a', 'b'],
					},
				},
			],
		};

		const { results, warnings } = await hitsToEdges({ hits, nestedFieldNames: [], nestingPrefix: 'data', Parallel });

		assert.equal(results[0].node.sample_registrations, 'a');
		assert.equal(warnings.length, 1);
		assert.equal(warnings[0].fullPath, 'sample_registrations');
	});
});

suite('hitsToEdges with a field the schema types as JSON', () => {
	/** A saved set's filter holding single-value lists at several depths, and a list of several values. */
	const STORED_FILTER = {
		content: [
			{ content: { fieldName: 'name', value: ['p1'] }, op: 'in' },
			{
				content: [
					{ content: { fieldName: 'tag', value: ['x'] }, op: 'in' },
					{ content: { fieldName: 'study', value: ['a', 'b'] }, op: 'in' },
				],
				op: 'or',
			},
		],
		op: 'and',
	};

	test('serves it whole, exactly as stored, single-value lists at every depth included, with no warning', async () => {
		// Given a hit whose JSON field holds lists at several depths
		const hits = { hits: [{ _id: 'set1', _source: { ids: ['p1'], sqon: STORED_FILTER } }] };

		// When it is mapped to an edge, the field named as JSON
		const { results, warnings } = await hitsToEdges({
			extendedFields: [{ fieldName: 'ids', isArray: true }],
			hits,
			jsonFieldPaths: ['sqon'],
			nestedFieldNames: [],
			Parallel,
		});

		// Then the field is the stored value itself, and nothing is reported dropped
		assert.deepEqual(results[0].node.sqon, STORED_FILTER);
		assert.deepEqual(results[0].node.ids, ['p1']);
		assert.deepEqual(warnings, []);
	});

	test('serves a JSON field that is itself a list whole', async () => {
		const hits = { hits: [{ _id: 'set1', _source: { sqon: [STORED_FILTER, STORED_FILTER] } }] };

		const { results, warnings } = await hitsToEdges({
			hits,
			jsonFieldPaths: ['sqon'],
			nestedFieldNames: [],
			Parallel,
		});

		assert.deepEqual(results[0].node.sqon, [STORED_FILTER, STORED_FILTER]);
		assert.deepEqual(warnings, []);
	});
});
