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

});