import assert from 'node:assert';
import { suite, test } from 'node:test';

import { cloneDeep } from 'lodash-es';

import injectNestedFiltersToAggs from '#middleware/buildAggregations/injectNestedFiltersToAggs.js';

suite('middleware/injectNestedFiltersToAggs', () => {

	test('1.injectNestedFiltersToAggs should not be mutative', () => {
		const aggs = {
			nested: {
				path: 'participants',
			},
			aggs: {
				'participants.diagnoses.source_text_diagnosis:nested': {
					nested: {
						path: 'participants.diagnoses',
					},
					aggs: {
						'participants.diagnoses.source_text_diagnosis': {
							aggs: {
								rn: {
									reverse_nested: {},
								},
							},
							terms: {
								field: 'participants.diagnoses.source_text_diagnosis',
								size: 300000,
							},
						},
						'participants.diagnoses.source_text_diagnosis:missing': {
							aggs: {
								rn: {
									reverse_nested: {},
								},
							},
							missing: {
								field: 'participants.diagnoses.source_text_diagnosis',
							},
						},
					},
				},
			},
		};

		const nestedSqonFilters = {
			'participants.diagnoses': [
				{
					op: 'in',
					content: {
						fieldName: 'participants.diagnoses.mondo_id_diagnosis',
						value: ['SOME_VALUE'],
					},
				},
				{
					op: 'in',
					content: {
						fieldName: 'participants.diagnoses.source_text_diagnosis',
						value: ['SOME_VALUE'],
					},
				},
			],
		};

		const expectedOriginalAggs = cloneDeep(aggs);

		injectNestedFiltersToAggs({ aggs, nestedSqonFilters });

		assert.deepEqual(aggs, expectedOriginalAggs);
	});

	test('2.injectNestedFiltersToAggs applies a configured nestingPrefix before comparing the aggregation field against nested sqon filters', () => {
		const aggs = {
			'biomarker.alc:nested': {
				nested: { path: 'data.biomarker' },
				aggs: {
					'biomarker.alc': {
						terms: { field: 'data.biomarker.alc', size: 300000 },
					},
				},
			},
		};

		const nestedSqonFilters = {
			'data.biomarker': [
				{
					op: 'in',
					content: { fieldName: 'data.biomarker.alc', value: ['SOME_VALUE'] },
				},
			],
		};

		const result = injectNestedFiltersToAggs({ aggs, nestedSqonFilters, nestingPrefix: 'data' });

		// the filter is on the same field this aggregation is for, so it's excluded from `should`
		// (self-filtering exclusion), the same behaviour as the unprefixed case, just correctly
		// matched against the real, prefixed ES path instead of the clean response-facing name.
		assert.deepEqual(result['biomarker.alc:nested'].aggs['data.biomarker:filtered'].filter.bool.should, []);
	});

	test("3.injectNestedFiltersToAggs still includes a nested filter on a different field, even with nestingPrefix configured", () => {
		const aggs = {
			'biomarker.alc:nested': {
				nested: { path: 'data.biomarker' },
				aggs: {
					'biomarker.alc': {
						terms: { field: 'data.biomarker.alc', size: 300000 },
					},
				},
			},
		};

		const nestedSqonFilters = {
			'data.biomarker': [
				{
					op: 'in',
					content: { fieldName: 'data.biomarker.anc', value: ['SOME_VALUE'] },
				},
			],
		};

		const result = injectNestedFiltersToAggs({ aggs, nestedSqonFilters, nestingPrefix: 'data' });

		assert.equal(result['biomarker.alc:nested'].aggs['data.biomarker:filtered'].filter.bool.should.length, 1);
	});

});