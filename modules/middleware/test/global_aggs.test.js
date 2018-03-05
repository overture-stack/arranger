import AggregationProcessor from '../src/aggregations.js';

let input = {
  type: {
    index: 'file',
    es_type: 'file',
    name: 'file',
  },
  fields: ['acl'],
  nested_fields: [],
  graphql_fields: {
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
      content: [{ op: 'in', content: { field: 'acl', value: ['phs000178'] } }],
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
      ],
    },
  },
  aggs: {
    'acl:global': {
      global: {},
      aggs: {
        'acl:filtered': {
          filter: {
            match_all: {},
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
  },
};

test('build_aggregations should handle `aggregations_filter_themselves` variable', () => {
  const actual = new AggregationProcessor().buildAggregations(input);
  expect(actual).toEqual(expected);
});
