import { createNodeQueryString } from '../resolvers/aggregations';

describe('gql query creation', () => {
	test('it should create gql query string for hits and aggregations using document name', () => {
		const result = createNodeQueryString('testFile', {
			donors: {
				buckets: {
					bucket_count: {},
				},
			},
		})
			// whitespace doesn't matter in the gql string, there are spaces for readability in code
			.replaceAll(' ', '');

		expect(result).toEqual('{testFile{hits{total}aggregations{donors{buckets{bucket_count}}}}}');
	});
});
