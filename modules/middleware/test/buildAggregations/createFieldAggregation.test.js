import createFieldAggregation from '../../src/buildAggregations/createFieldAggregation';

test('it should handle multiple aggregation types per field', () => {
  const input = {
    field: 'sequencing_experiments.mean_depth',
    graphqlField: {
      stats: { max: {} },
      histogram: {
        buckets: { doc_count: {}, key: {} },
        __arguments: [{ interval: { kind: 'IntValue', value: '5' } }],
      },
    },
    isNested: 1,
  };

  const output = {
    'sequencing_experiments.mean_depth:stats': {
      stats: { field: 'sequencing_experiments.mean_depth' },
    },
    'sequencing_experiments.mean_depth:histogram': {
      histogram: {
        field: 'sequencing_experiments.mean_depth',
        interval: '5',
      },
    },
  };

  expect(createFieldAggregation(input)).toEqual(output);
});
