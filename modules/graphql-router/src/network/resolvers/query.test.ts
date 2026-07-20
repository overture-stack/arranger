import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { parse } from 'graphql';

import { createRemoteNodeGQLQuery } from './query.js';

suite('createRemoteNodeGQLQuery', () => {
	test('with no requested fields, declares $filters and omits the aggregations selection', () => {
		const gqlString = createRemoteNodeGQLQuery('file', {});

		assert.doesNotThrow(() => parse(gqlString));
		assert.match(gqlString, /query nodeQuery\(\$filters: JSON\)/);
		assert.ok(gqlString.includes('hits (filters: $filters)'));
		assert.ok(!gqlString.includes('aggregations('));
	});

	test('with requested fields, declares $filters alongside the aggregation variables', () => {
		const gqlString = createRemoteNodeGQLQuery('file', {
			donor: { buckets: { bucket_count: {} } },
		});

		assert.doesNotThrow(() => parse(gqlString));
		assert.match(
			gqlString,
			/query nodeQuery\(\$filters: JSON, \$aggregations_filter_themselves: Boolean, \$include_missing: Boolean\)/,
		);
		assert.ok(gqlString.includes('hits (filters: $filters)'));
		assert.ok(gqlString.includes('aggregations('));
		assert.ok(gqlString.includes('donor'));
	});
});
