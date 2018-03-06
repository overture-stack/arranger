import AggregationProcessor from '../src/aggregations.js';

let input = {
  type: {
    index: 'file',
    es_type: 'file',
    name: 'file',
  },
  fields: ['acl', 'mdx'],
  nested_fields: [],
  graphql_fields: {
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
  args: {
    filters: {
      op: 'and',
      content: [
        { op: 'in', content: { field: 'acl', value: ['phs000178'] } },
        { op: '>=', content: { field: 'mdx', value: 100 } },
        { op: '<=', content: { field: 'mdx', value: 200 } },
      ],
    },
    aggregations_filter_themselves: false,
  },
};

let expected = {
  query: {
    bool: {
      must: [
        {
          terms: {
            acl: ['phs000178'],
            boost: 0,
          },
        },
        { range: { mdx: { boost: 0, gte: 100 } } },
        { range: { mdx: { boost: 0, lte: 200 } } },
      ],
    },
  },
  aggs: {
    'acl:global': {
      global: {},
      aggs: {
        'acl:filtered': {
          filter: {
            bool: {
              must: [
                { range: { mdx: { boost: 0, gte: 100 } } },
                { range: { mdx: { boost: 0, lte: 200 } } },
              ],
            },
          },
          aggs: {
            acl: {
              terms: {
                field: 'acl',
                size: 100,
              },
            },
          },
        },
      },
    },
    'mdx:global': {
      global: {},
      aggs: {
        'mdx:filtered': {
          filter: {
            terms: {
              acl: ['phs000178'],
              boost: 0,
            },
          },
          aggs: {
            'mdx:stats': {
              stats: { field: 'mdx' },
            },
          },
        },
      },
    },
  },
};

test('build_aggregations should handle `aggregations_filter_themselves` variable', () => {
  const actual = new AggregationProcessor().buildAggregations(input);
  expect(actual).toEqual(expected);
});
