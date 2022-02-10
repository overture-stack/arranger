import createFieldAggregation from '../../buildAggregations/createFieldAggregation';

test('it should compute aggregation cardinality (for field files.kf_id)', () => {
  const input = {
    field: 'files.kf_id',
    graphqlField: {
      cardinality: {},
    },
    isNested: 1,
  };
  const output = {
    'files.kf_id:cardinality': {
      cardinality: { field: 'files.kf_id', precision_threshold: 40000 },
    },
  };
  expect(createFieldAggregation(input)).toEqual(output);
});

test('it should compute aggregation cardinality (for field family_id)', () => {
  const input = {
    field: 'family_id',
    graphqlField: {
      cardinality: {},
    },
    isNested: 0,
  };
  const output = {
    'family_id:cardinality': {
      cardinality: { field: 'family_id', precision_threshold: 40000 },
    },
  };
  expect(createFieldAggregation(input)).toEqual(output);
});

test('it should compute top hits aggregation', () => {
  const input = {
    field: 'observed_phenotype.name',
    size: 1,
    source: ['observed_Phenotype.parents'],
    graphqlField: {
      buckets: {
        key: {},
        doc_count: {},
        top_hits: {
          __arguments: [
            {
              _source: {
                kind: 'ListValue',
                value: ['observed_phenotype.parents'],
              },
            },
            {
              size: {
                kind: 'IntValue',
                value: 1,
              },
            },
          ],
        },
      },
    },
  };
  const output = {
    'observed_phenotype.name': {
      terms: {
        field: 'observed_phenotype.name',
        size: 300000,
      },
      aggs: {
        'observed_phenotype.name.hits': {
          top_hits: {
            _source: ['observed_phenotype.parents'],
            size: 1,
          },
        },
      },
    },
    'observed_phenotype.name:missing': {
      missing: {
        field: 'observed_phenotype.name',
      },
    },
  };
  expect(createFieldAggregation(input)).toEqual(output);
});

test('it should compute top hits aggregation and revert nested', () => {
  const input = {
    field: 'observed_phenotype.name',
    size: 1,
    source: ['observed_Phenotype.parents'],
    isNested: 1,
    graphqlField: {
      buckets: {
        key: {},
        doc_count: {},
        top_hits: {
          __arguments: [
            {
              _source: {
                kind: 'ListValue',
                value: ['observed_phenotype.parents'],
              },
            },
            {
              size: {
                kind: 'IntValue',
                value: 1,
              },
            },
          ],
        },
      },
    },
  };
  const output = {
    'observed_phenotype.name': {
      terms: {
        field: 'observed_phenotype.name',
        size: 300000,
      },
      aggs: {
        rn: { reverse_nested: {} },
        'observed_phenotype.name.hits': {
          top_hits: {
            _source: ['observed_phenotype.parents'],
            size: 1,
          },
        },
      },
    },
    'observed_phenotype.name:missing': {
      missing: {
        field: 'observed_phenotype.name',
      },
      aggs: {
        rn: { reverse_nested: {} },
      },
    },
  };
  expect(createFieldAggregation(input)).toEqual(output);
});

test('it should compute top hits aggregation and filter by term aggregation', () => {
  const qVariable = {
    kind: 'Variable',
    value: {
      op: 'and',
      content: [{ op: 'in', content: { field: 'observed_phenotype.is_tagged', value: 'true' } }],
    },
  };

  const input = {
    field: 'observed_phenotype.name',
    size: 1,
    source: ['observed_Phenotype.parents'],
    graphqlField: {
      buckets: {
        key: {},
        doc_count: {},
        top_hits: {
          __arguments: [
            {
              _source: {
                kind: 'ListValue',
                value: ['observed_phenotype.parents', 'observed_phenotype.is_tagged'],
              },
            },
            {
              size: {
                kind: 'IntValue',
                value: 1,
              },
            },
          ],
        },
        filter_by_term: {
          __arguments: [
            {
              filter: qVariable,
            },
          ],
        },
      },
    },
  };
  const output = {
    'observed_phenotype.name': {
      terms: {
        field: 'observed_phenotype.name',
        size: 300000,
      },
      aggs: {
        'observed_phenotype.name.hits': {
          top_hits: {
            _source: ['observed_phenotype.parents', 'observed_phenotype.is_tagged'],
            size: 1,
          },
        },
        term_filters: {
          filter: {
            bool: {
              must: [
                {
                  terms: {
                    'observed_phenotype.is_tagged': ['true'],
                    boost: 0,
                  },
                },
              ],
            },
          },
        },
      },
    },
    'observed_phenotype.name:missing': {
      missing: {
        field: 'observed_phenotype.name',
      },
    },
  };
  expect(createFieldAggregation(input)).toEqual(output);
});

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

test('it should generate nested terms filters in aggs ', () => {
  const input = {
    field: 'donors.zygosity',
    graphqlField: {
      buckets: {
        key: {},
        doc_count: {},
      },
    },
    isNested: 1,
    termFilters: [
      { terms: { 'donors.parental_origin': ['mother'], boost: 0 } },
      { terms: { 'donors.patient_id': ['PA00001'], boost: 0 } },
    ],
  };

  const output = {
    'donors.zygosity:nested_filtered': {
      filter: {
        bool: {
          must: [
            { terms: { 'donors.parental_origin': ['mother'], boost: 0 } },
            { terms: { 'donors.patient_id': ['PA00001'], boost: 0 } },
          ],
        },
      },
      aggs: {
        'donors.zygosity': {
          aggs: { rn: { reverse_nested: {} } },
          terms: { field: 'donors.zygosity', size: 300000 },
        },
        'donors.zygosity:missing': {
          aggs: { rn: { reverse_nested: {} } },
          missing: { field: 'donors.zygosity' },
        },
      },
    },
  };

  expect(createFieldAggregation(input)).toEqual(output);
});
