import buildAggregations from '../src/buildAggregations';
import filters from '../src/filters';

test('build_aggregations should handle `aggregations_filter_themselves` variable', () => {
  let input = {
    nestedFields: [],
    graphqlFields: {
      mdx: {
        stats: {
          min: {},
          max: {},
        },
      },
      acl: {
        buckets: {
          key: {},
          doc_count: {},
        },
      },
    },
    query: new filters().buildFilters([], {
      op: 'and',
      content: [
        { op: 'in', content: { field: 'acl', value: ['phs000178'] } },
        { op: '>=', content: { field: 'mdx', value: 100 } },
        { op: '<=', content: { field: 'mdx', value: 200 } },
      ],
    }),
    aggregationsFilterThemselves: false,
  };

  let expected = {
    'acl:global': {
      aggs: {
        'acl:filtered': {
          aggs: { acl: { terms: { field: 'acl', size: 300000 } } },
          filter: {
            bool: {
              must: [
                { range: { mdx: { boost: 0, gte: 100 } } },
                { range: { mdx: { boost: 0, lte: 200 } } },
              ],
            },
          },
        },
      },
      global: {},
    },
    'mdx:global': {
      aggs: {
        'mdx:filtered': {
          aggs: { 'mdx:stats': { stats: { field: 'mdx' } } },
          filter: {
            bool: {
              must: [{ terms: { acl: ['phs000178'], boost: 0 } }],
            },
          },
        },
      },
      global: {},
    },
  };
  const actualOutput = buildAggregations(input);
  expect(actualOutput).toEqual(expected);
});
