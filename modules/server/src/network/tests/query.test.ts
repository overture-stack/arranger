// import { describe, test } from 'node:test';
// import { expect } from '@jest/globals';

// import { createFileGQLQuery } from '../resolvers/query.js';

// describe.todo('gql query creation', () => {
// 	test.todo('it should create gql query string for hits and aggregations using document name', () => {
// 		const result = createFileGQLQuery('testFile', {
// 			donors: {
// 				buckets: {
// 					bucket_count: {},
// 				},
// 			},
// 		})
// 			// whitespace doesn't matter in the gql string, there are spaces for readability in code
// 			.replaceAll(' ', '');

// 		const expected =
// 			'query nodeQuery($filters: JSON, $aggregations_filter_themselves: Boolean, $include_missing: Boolean) {testFile { hits { total }  aggregations(filters:$filters,aggregations_filter_themselves:$aggregations_filter_themselves,include_missing:$include_missing){donors{buckets{bucket_count}}} }}'.replaceAll(
// 				' ',
// 				'',
// 			);
// 		expect(result).toEqual(expected);
// 	});
// });
