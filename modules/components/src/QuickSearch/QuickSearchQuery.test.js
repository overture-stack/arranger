import { getQuickSearchQueryOptions } from './QuickSearchQuery.js';

describe('getQuickSearchQueryOptions', () => {
	it('passes apiUrl through as url, so QuickSearch queries reach the same catalogue-scoped base as the rest of the provider', () => {
		const options = getQuickSearchQueryOptions({
			apiUrl: 'https://arranger-search.dev.overture.bio/donor',
			documentType: 'donor',
			queryCallback: () => {},
			searchFields: [{ fieldName: 'name', gqlField: 'name', query: 'name' }],
			searchText: 'ab',
		});

		expect(options.url).toBe('https://arranger-search.dev.overture.bio/donor');
	});

	it('passes url as undefined when apiUrl is omitted (single-catalogue mode)', () => {
		const options = getQuickSearchQueryOptions({
			documentType: 'donor',
			queryCallback: () => {},
			searchFields: [{ fieldName: 'name', gqlField: 'name', query: 'name' }],
			searchText: 'ab',
		});

		expect(options.url).toBeUndefined();
	});

	it('only sets shouldFetch when the search text is long enough and search fields exist, unaffected by apiUrl', () => {
		const tooShort = getQuickSearchQueryOptions({
			apiUrl: 'https://example.com',
			documentType: 'donor',
			searchFields: [{ fieldName: 'name', gqlField: 'name', query: 'name' }],
			searchText: 'a',
		});
		const noFields = getQuickSearchQueryOptions({
			apiUrl: 'https://example.com',
			documentType: 'donor',
			searchFields: [],
			searchText: 'ab',
		});
		const valid = getQuickSearchQueryOptions({
			apiUrl: 'https://example.com',
			documentType: 'donor',
			searchFields: [{ fieldName: 'name', gqlField: 'name', query: 'name' }],
			searchText: 'ab',
		});

		expect(tooShort.shouldFetch).toBeFalsy();
		expect(noFields.shouldFetch).toBeFalsy();
		expect(valid.shouldFetch).toBeTruthy();
	});
});
