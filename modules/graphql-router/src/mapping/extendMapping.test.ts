import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { extendFacets } from './extendMapping.js';

suite('extendFacets', () => {
	test('matches a facets.json entry against extended fields by its raw dotted path', () => {
		const result = extendFacets(
			{ aggregations: [{ fieldName: 'biomarker.ca19-9_level' }] },
			[{ displayName: 'CA19-9 Level', displayType: 'keyword', fieldName: 'biomarker.ca19-9_level' }],
		);

		assert.equal(result.aggregations?.[0]?.displayName, 'CA19-9 Level');
	});

	test('still matches a facets.json entry written in the legacy __-escaped form', () => {
		const result = extendFacets(
			{ aggregations: [{ fieldName: 'biomarker__ca19-9_level' }] },
			[{ displayName: 'CA19-9 Level', displayType: 'keyword', fieldName: 'biomarker.ca19-9_level' }],
		);

		assert.equal(result.aggregations?.[0]?.displayName, 'CA19-9 Level');
	});

	test('sanitizes hyphens (not just dots) in the auto-generated default aggregations fieldName', () => {
		const result = extendFacets({ aggregations: [] }, [
			{ displayName: 'CA19-9 Level', displayType: 'keyword', fieldName: 'biomarker.ca19-9_level' },
		]);

		assert.equal(result.aggregations?.[0]?.fieldName, 'biomarker__ca19_9_level');
	});
});
