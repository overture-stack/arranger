import AggregationProcessor from '../src/aggregations.js';

test('build_aggregations should handle nested aggregations', () => {
  const input = {
    filters: {},
    fields: [
      'access',
      'cases__samples__portions__is_ffpe',
      'cases__samples__portions__slides__annotations__notes',
      'cases__samples__portions__slides__annotations__category',
    ],
    nested_fields: [
      'annotations',
      'associated_entities',
      'cases',
      'cases.annotations',
      'cases.diagnoses',
      'cases.diagnoses.treatments',
      'cases.exposures',
      'cases.family_histories',
      'cases.samples',
      'cases.samples.annotations',
      'cases.samples.portions',
      'cases.samples.portions.analytes',
      'cases.samples.portions.analytes.aliquots',
      'cases.samples.portions.analytes.aliquots.annotations',
      'cases.samples.portions.analytes.annotations',
      'cases.samples.portions.annotations',
      'cases.samples.portions.slides',
      'cases.samples.portions.slides.annotations',
      'downstream_analyses',
      'downstream_analyses.output_files',
      'index_files',
      'metadata_files',
    ],
    graphql_fields: {
      access: { buckets: { key: {} } },
      cases__samples__portions__is_ffpe: { buckets: { key: {} } },
      cases__samples__portions__slides__annotations__notes: {
        buckets: { key: {} },
      },
      cases__samples__portions__slides__annotations__category: {
        buckets: { key: {} },
      },
    },
    global_aggregations: true,
  };

  const expectedOutput = {
    access: {
      terms: {
        field: 'access',
        size: 300000,
      },
    },
    cases: {
      nested: {
        path: 'cases',
      },
      aggs: {
        'cases.samples': {
          nested: {
            path: 'cases.samples',
          },
          aggs: {
            'cases.samples.portions': {
              nested: {
                path: 'cases.samples.portions',
              },
              aggs: {
                'cases.samples.portions.is_ffpe': {
                  aggs: {
                    rn: {
                      reverse_nested: {},
                    },
                  },
                  terms: {
                    field: 'cases.samples.portions.is_ffpe',
                    size: 300000,
                  },
                },
                'cases.samples.portions.slides': {
                  nested: {
                    path: 'cases.samples.portions.slides',
                  },
                  aggs: {
                    'cases.samples.portions.slides.annotations': {
                      nested: {
                        path: 'cases.samples.portions.slides.annotations',
                      },
                      aggs: {
                        'cases.samples.portions.slides.annotations.notes': {
                          aggs: {
                            rn: {
                              reverse_nested: {},
                            },
                          },
                          terms: {
                            field:
                              'cases.samples.portions.slides.annotations.notes',
                            size: 300000,
                          },
                        },
                        'cases.samples.portions.slides.annotations.category': {
                          aggs: {
                            rn: {
                              reverse_nested: {},
                            },
                          },
                          terms: {
                            field:
                              'cases.samples.portions.slides.annotations.category',
                            size: 300000,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  const actualOutput = new AggregationProcessor().build_aggregations(input);
  expect(actualOutput).toEqual(expectedOutput);
});

test('build_aggregations should handle nested aggregations with filters on same field', () => {
  const input = {
    filters: {
      bool: {
        must: [
          {
            nested: {
              path: 'participants',
              query: {
                bool: {
                  must: [
                    {
                      terms: {
                        'participants.kf_id': ['PT_87QW2JKA'],
                        boost: 0,
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
    fields: ['participants__kf_id'],
    nested_fields: ['participants'],
    graphql_fields: {
      participants__kf_id: { buckets: { key: {} } },
    },
    global_aggregations: true,
  };

  const expectedOutput = {
    'participants:global': {
      aggs: {
        participants: {
          aggs: {
            'participants.kf_id': {
              aggs: { rn: { reverse_nested: {} } },
              terms: { field: 'participants.kf_id', size: 300000 },
            },
          },
          nested: { path: 'participants' },
        },
      },
      global: {},
    },
  };
  const actualOutput = new AggregationProcessor().build_aggregations(input);
  expect(actualOutput).toEqual(expectedOutput);
});
