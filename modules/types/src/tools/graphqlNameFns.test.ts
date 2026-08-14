import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import fastCheck from 'fast-check';

import { sanitizeGraphqlFlatName, sanitizeGraphqlNameSegment } from './graphqlNameFns.js';

const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

suite('sanitizeGraphqlNameSegment', () => {
	test('leaves an already-valid name unchanged', () => {
		assert.equal(sanitizeGraphqlNameSegment('donor_id'), 'donor_id');
	});

	test('replaces a hyphen with an underscore', () => {
		assert.equal(sanitizeGraphqlNameSegment('ca19-9_level'), 'ca19_9_level');
	});

	test('replaces every disallowed character, not just the first', () => {
		assert.equal(sanitizeGraphqlNameSegment('pd-l1-status'), 'pd_l1_status');
	});

	test('prefixes an underscore when the result would start with a digit', () => {
		assert.equal(sanitizeGraphqlNameSegment('1.0'), '_1_0');
	});

	test('does not double-prefix a name that already starts with a letter', () => {
		assert.equal(sanitizeGraphqlNameSegment('donor'), 'donor');
	});

	test('property: always produces a valid GraphQL name for any non-empty segment', () => {
		// A real field/document-type name is never the empty string; sanitizeGraphqlNameSegment
		// makes no claim about that case (it returns '', which is not a valid GraphQL name).
		fastCheck.assert(fastCheck.property(fastCheck.string({ minLength: 1 }), (segment) => GRAPHQL_NAME.test(sanitizeGraphqlNameSegment(segment))));
	});

	test('property: is idempotent for any input, including the empty string', () => {
		fastCheck.assert(
			fastCheck.property(fastCheck.string(), (segment) => {
				const once = sanitizeGraphqlNameSegment(segment);
				assert.equal(sanitizeGraphqlNameSegment(once), once);
			}),
		);
	});
});

suite('sanitizeGraphqlFlatName', () => {
	test('replaces dots with a double underscore, preserving the existing aggregation-name convention', () => {
		assert.equal(sanitizeGraphqlFlatName('donor.age'), 'donor__age');
	});

	test('replaces a hyphen with a single underscore', () => {
		assert.equal(sanitizeGraphqlFlatName('biomarker.ca19-9_level'), 'biomarker__ca19_9_level');
	});

	test('leaves an already-valid flat name unchanged', () => {
		assert.equal(sanitizeGraphqlFlatName('donor_id'), 'donor_id');
	});

	test('does not collide a dotted path with an unrelated field that already contains a single underscore', () => {
		assert.notEqual(sanitizeGraphqlFlatName('donor.id'), sanitizeGraphqlFlatName('donor_id'));
	});

	test('property: always produces a valid GraphQL name for any non-empty path', () => {
		// Same non-empty caveat as sanitizeGraphqlNameSegment above: a real ES field path is never ''.
		fastCheck.assert(fastCheck.property(fastCheck.string({ minLength: 1 }), (dottedPath) => GRAPHQL_NAME.test(sanitizeGraphqlFlatName(dottedPath))));
	});

	test('property: is idempotent for any input, including the empty string', () => {
		fastCheck.assert(
			fastCheck.property(fastCheck.string(), (dottedPath) => {
				const once = sanitizeGraphqlFlatName(dottedPath);
				assert.equal(sanitizeGraphqlFlatName(once), once);
			}),
		);
	});
});
