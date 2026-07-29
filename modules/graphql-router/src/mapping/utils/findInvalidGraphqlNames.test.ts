import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import findInvalidGraphqlNames from './findInvalidGraphqlNames.js';

suite('findInvalidGraphqlNames', () => {
	test('returns an empty array when every name is a valid GraphQL identifier', () => {
		const result = findInvalidGraphqlNames({
			documentType: 'donor',
			fieldsFromMapping: [
				{ fieldName: 'donor_id', type: 'keyword' },
				{ fieldName: 'biomarkers', type: 'nested' },
				{ fieldName: 'biomarkers.alc', type: 'integer' },
			],
		});

		assert.deepEqual(result, []);
	});

	test('reports a nested field name containing a hyphen, by its full dotted path', () => {
		const result = findInvalidGraphqlNames({
			documentType: 'donor',
			fieldsFromMapping: [
				{ fieldName: 'biomarkers', type: 'nested' },
				{ fieldName: 'biomarkers.ca19-9_level', type: 'keyword' },
			],
		});

		assert.equal(result.length, 1);
		assert.equal(result[0]?.path, 'biomarkers.ca19-9_level');
	});

	test('reports an invalid document type name', () => {
		const result = findInvalidGraphqlNames({
			documentType: 'donor-1.0',
			fieldsFromMapping: [],
		});

		assert.equal(result.length, 1);
		assert.equal(result[0]?.path, 'donor-1.0');
	});

	test('collects every offender in one pass, not just the first', () => {
		const result = findInvalidGraphqlNames({
			documentType: 'donor-1.0',
			fieldsFromMapping: [
				{ fieldName: 'pd-l1_status', type: 'keyword' },
				{ fieldName: 'pan-trk_ihc_status', type: 'keyword' },
				{ fieldName: 'non-hematological_toxicity', type: 'keyword' },
			],
		});

		assert.deepEqual(
			result.map((issue) => issue.path),
			['donor-1.0', 'pd-l1_status', 'pan-trk_ihc_status', 'non-hematological_toxicity'],
		);
	});

	test('ignores a field whose ES type has no GraphQL mapping, since Arranger never turns it into a GraphQL name', () => {
		const result = findInvalidGraphqlNames({
			fieldsFromMapping: [{ fieldName: 'some-unsupported-field', type: 'geo_point' }],
		});

		assert.deepEqual(result, []);
	});

	test('validates only the leaf segment of a dotted path, not the full path', () => {
		const result = findInvalidGraphqlNames({
			fieldsFromMapping: [
				{ fieldName: 'donor', type: 'object' },
				{ fieldName: 'donor.age', type: 'integer' },
			],
		});

		assert.deepEqual(result, []);
	});
});
