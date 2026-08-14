import { AggregationsList } from './Aggregations.js';

// `AggregationsList` is a plain function component (unlike the default `Aggregations` export,
// which is wrapped with `withData` and needs a real render to exercise its hook); calling it
// directly returns the `AggsQuery` element it builds, enough to assert on prop threading without
// jsdom/@testing-library, neither of which this module has (see tech-debt.md).
describe('AggregationsList', () => {
	it('threads apiUrl through to AggsQuery, so facet/aggregation queries reach the same catalogue-scoped base as the main table', () => {
		const fakeApiFetcher = () => Promise.resolve({});

		const element = AggregationsList({
			aggs: [{ fieldName: 'status', displayType: 'Aggregations' }],
			apiFetcher: fakeApiFetcher,
			apiUrl: 'https://arranger-search.dev.overture.bio/donor',
			documentType: 'donor',
			extendedMapping: [],
			getCustomItems: () => [],
			sqon: null,
		});

		expect(element.props.apiUrl).toBe('https://arranger-search.dev.overture.bio/donor');
		expect(element.props.apiFetcher).toBe(fakeApiFetcher);
	});

	it('passes apiUrl as undefined when omitted, matching single-catalogue mode where no scoping is needed', () => {
		const element = AggregationsList({
			aggs: [],
			documentType: 'donor',
			extendedMapping: [],
			getCustomItems: () => [],
		});

		expect(element.props.apiUrl).toBeUndefined();
	});
});
