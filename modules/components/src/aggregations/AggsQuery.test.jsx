import AggsQuery from './AggsQuery.js';

// `AggsQuery` is a plain function component; calling it directly (no renderer) returns the React
// element it builds, which is enough to assert on the props it passes to `Query` without needing
// jsdom/@testing-library, neither of which this module has (see tech-debt.md).
describe('AggsQuery', () => {
	it('passes apiUrl through to Query as url, so aggregation requests reach the same base as the rest of the provider', () => {
		const fakeApiFetcher = () => Promise.resolve({});

		const element = AggsQuery({
			aggs: [{ fieldName: 'status', displayType: 'Aggregations' }],
			apiFetcher: fakeApiFetcher,
			apiUrl: 'https://arranger-search.dev.overture.bio/donor',
			documentType: 'donor',
			sqon: null,
		});

		expect(element.props.url).toBe('https://arranger-search.dev.overture.bio/donor');
		expect(element.props.apiFetcher).toBe(fakeApiFetcher);
	});

	it('passes url as undefined, not a stringified default, when apiUrl is omitted (single-catalogue mode)', () => {
		const element = AggsQuery({
			aggs: [{ fieldName: 'status', displayType: 'Aggregations' }],
			documentType: 'donor',
		});

		expect(element.props.url).toBeUndefined();
	});

	it('renders nothing when there is no documentType or no aggs yet, unaffected by apiUrl', () => {
		expect(AggsQuery({ apiUrl: 'https://example.com', documentType: '', aggs: [] })).toBeNull();
		expect(AggsQuery({ apiUrl: 'https://example.com', documentType: 'donor', aggs: [] })).toBeNull();
	});
});
