import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	applyNestingPrefix,
	applyNestingPrefixToFieldNames,
	applyNestingPrefixToSqon,
	unwrapHits,
	unwrapSource,
} from './nestingPrefix.js';

suite('applyNestingPrefix', () => {
	test('prepends the prefix to a field name', () => {
		assert.equal(applyNestingPrefix('age_at_menarche', 'data'), 'data.age_at_menarche');
	});

	test('returns the field name unchanged when no prefix is configured', () => {
		assert.equal(applyNestingPrefix('age_at_menarche', undefined), 'age_at_menarche');
	});

	test('returns the field name unchanged for an empty-string prefix', () => {
		assert.equal(applyNestingPrefix('age_at_menarche', ''), 'age_at_menarche');
	});

	test('returns undefined unchanged when there is no field name', () => {
		assert.equal(applyNestingPrefix(undefined, 'data'), undefined);
	});
});

suite('applyNestingPrefixToFieldNames', () => {
	test('prepends the prefix to every field name in the list', () => {
		assert.deepEqual(applyNestingPrefixToFieldNames(['biomarker', 'comorbidity'], 'data'), [
			'data.biomarker',
			'data.comorbidity',
		]);
	});

	test('returns the list unchanged when no prefix is configured', () => {
		const fieldNames = ['biomarker'];
		assert.equal(applyNestingPrefixToFieldNames(fieldNames, undefined), fieldNames);
	});
});

suite('applyNestingPrefixToSqon', () => {
	test('prefixes a leaf filter\'s fieldName', () => {
		const sqon = { op: 'in', pivot: null, content: { fieldName: 'age_at_menarche', value: [10] } };

		assert.deepEqual(applyNestingPrefixToSqon(sqon, 'data'), {
			op: 'in',
			pivot: null,
			content: { fieldName: 'data.age_at_menarche', value: [10] },
		});
	});

	test('prefixes every fieldName in a wildcard filter\'s fieldNames list', () => {
		const sqon = { op: 'filter', content: { fieldNames: ['biomarker.alc', 'bmi'], value: 'x' } };

		assert.deepEqual(applyNestingPrefixToSqon(sqon, 'data').content.fieldNames, [
			'data.biomarker.alc',
			'data.bmi',
		]);
	});

	test('recurses into a group filter\'s content array, prefixing every leaf', () => {
		const sqon = {
			op: 'and',
			pivot: null,
			content: [
				{ op: 'in', pivot: null, content: { fieldName: 'bmi', value: [1] } },
				{ op: 'in', pivot: null, content: { fieldName: 'biomarker.alc', value: [2] } },
			],
		};

		const result = applyNestingPrefixToSqon(sqon, 'data');

		assert.equal(result.content[0].content.fieldName, 'data.bmi');
		assert.equal(result.content[1].content.fieldName, 'data.biomarker.alc');
	});

	test('prefixes a real pivot value, but leaves the root pivot "." untouched', () => {
		const rootSqon = { op: 'and', pivot: '.', content: [] };
		const nestedSqon = { op: 'and', pivot: 'biomarker', content: [] };

		assert.equal(applyNestingPrefixToSqon(rootSqon, 'data').pivot, '.');
		assert.equal(applyNestingPrefixToSqon(nestedSqon, 'data').pivot, 'data.biomarker');
	});

	test('leaves a null pivot as null', () => {
		const sqon = { op: 'in', pivot: null, content: { fieldName: 'bmi', value: [1] } };

		assert.equal(applyNestingPrefixToSqon(sqon, 'data').pivot, null);
	});

	test('returns the sqon unchanged when no prefix is configured', () => {
		const sqon = { op: 'in', content: { fieldName: 'bmi', value: [1] } };

		assert.equal(applyNestingPrefixToSqon(sqon, undefined), sqon);
	});

	test('returns a falsy sqon unchanged', () => {
		assert.equal(applyNestingPrefixToSqon(null, 'data'), null);
	});
});

suite('unwrapSource', () => {
	test('merges a single-level envelope\'s own properties onto the top level', () => {
		const source = { data: { age_at_menarche: 12, bmi: 24.5 }, entityName: 'donor' };

		assert.deepEqual(unwrapSource(source, 'data'), {
			data: { age_at_menarche: 12, bmi: 24.5 },
			entityName: 'donor',
			age_at_menarche: 12,
			bmi: 24.5,
		});
	});

	test('walks a dotted, multi-level prefix', () => {
		const source = { envelope: { payload: { bmi: 24.5 } } };

		assert.deepEqual(unwrapSource(source, 'envelope.payload'), {
			envelope: { payload: { bmi: 24.5 } },
			bmi: 24.5,
		});
	});

	test('returns the source unchanged when no prefix is configured', () => {
		const source = { bmi: 24.5 };
		assert.equal(unwrapSource(source, undefined), source);
	});

	test('returns the source unchanged when the configured prefix is not found', () => {
		const source = { bmi: 24.5 };
		assert.equal(unwrapSource(source, 'data'), source);
	});

	test('returns undefined unchanged when there is no source', () => {
		assert.equal(unwrapSource(undefined, 'data'), undefined);
	});
});

suite('unwrapHits', () => {
	test('unwraps every hit\'s _source in a hits response', () => {
		const hits = {
			hits: [
				{ _id: '1', _source: { data: { bmi: 24.5 } } },
				{ _id: '2', _source: { data: { bmi: 30 } } },
			],
			total: { value: 2 },
		};

		const result = unwrapHits(hits, 'data');

		assert.deepEqual(result?.hits[0]?._source, { data: { bmi: 24.5 }, bmi: 24.5 });
		assert.deepEqual(result?.hits[1]?._source, { data: { bmi: 30 }, bmi: 30 });
		assert.equal(result?.total.value, 2);
	});

	test('returns hits unchanged when no prefix is configured', () => {
		const hits = { hits: [{ _id: '1', _source: { bmi: 24.5 } }] };
		assert.equal(unwrapHits(hits, undefined), hits);
	});

	test('returns undefined unchanged when there are no hits', () => {
		assert.equal(unwrapHits(undefined, 'data'), undefined);
	});
});
