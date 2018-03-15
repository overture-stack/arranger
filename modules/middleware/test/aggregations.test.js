import buildAggregations from '../src/buildAggregations.js';
import buildQuery from '../src/buildQuery';

test('build_aggregations should handle nested aggregations', () => {
  const nestedFields = [
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
  ];

  const input = {
    query: buildQuery({ nestedFields, filters: {} }),
    nestedFields,
    graphqlFields: {
      access: { buckets: { key: {} } },
      cases__samples__portions__is_ffpe: { buckets: { key: {} } },
      cases__samples__portions__slides__annotations__notes: {
        buckets: { key: {} },
      },
      cases__samples__portions__slides__annotations__category: {
        buckets: { key: {} },
      },
    },
    aggregationsFilterThemselves: false,
  };

  const expectedOutput = {
    access: { terms: { field: 'access', size: 300000 } },
    'cases.samples.portions.is_ffpe:nested': {
      nested: { path: 'cases' },
      aggs: {
        'cases.samples.portions.is_ffpe:nested': {
          nested: { path: 'cases.samples' },
          aggs: {
            'cases.samples.portions.is_ffpe:nested': {
              nested: { path: 'cases.samples.portions' },
              aggs: {
                'cases.samples.portions.is_ffpe': {
                  aggs: { rn: { reverse_nested: {} } },
                  terms: {
                    field: 'cases.samples.portions.is_ffpe',
                    size: 300000,
                  },
                },
              },
            },
          },
        },
      },
    },
    'cases.samples.portions.slides.annotations.notes:nested': {
      nested: { path: 'cases' },
      aggs: {
        'cases.samples.portions.slides.annotations.notes:nested': {
          nested: { path: 'cases.samples' },
          aggs: {
            'cases.samples.portions.slides.annotations.notes:nested': {
              nested: { path: 'cases.samples.portions' },
              aggs: {
                'cases.samples.portions.slides.annotations.notes:nested': {
                  nested: { path: 'cases.samples.portions.slides' },
                  aggs: {
                    'cases.samples.portions.slides.annotations.notes:nested': {
                      nested: {
                        path: 'cases.samples.portions.slides.annotations',
                      },
                      aggs: {
                        'cases.samples.portions.slides.annotations.notes': {
                          aggs: { rn: { reverse_nested: {} } },
                          terms: {
                            field:
                              'cases.samples.portions.slides.annotations.notes',
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
    'cases.samples.portions.slides.annotations.category:nested': {
      nested: { path: 'cases' },
      aggs: {
        'cases.samples.portions.slides.annotations.category:nested': {
          nested: { path: 'cases.samples' },
          aggs: {
            'cases.samples.portions.slides.annotations.category:nested': {
              nested: { path: 'cases.samples.portions' },
              aggs: {
                'cases.samples.portions.slides.annotations.category:nested': {
                  nested: { path: 'cases.samples.portions.slides' },
                  aggs: {
                    'cases.samples.portions.slides.annotations.category:nested': {
                      nested: {
                        path: 'cases.samples.portions.slides.annotations',
                      },
                      aggs: {
                        'cases.samples.portions.slides.annotations.category': {
                          aggs: { rn: { reverse_nested: {} } },
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
  const actualOutput = buildAggregations(input);
  expect(actualOutput).toEqual(expectedOutput);
});

test('build_aggregations should handle nested aggregations with filters on same field', () => {
  const nestedFields = ['participants'];
  const input = {
    query: {
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
    nestedFields,
    graphqlFields: {
      participants__kf_id: { buckets: { key: {} } },
    },
    aggregationsFilterThemselves: false,
  };

  const expectedOutput = {
    'participants.kf_id:global': {
      global: {},
      aggs: {
        'participants.kf_id:nested': {
          nested: { path: 'participants' },
          aggs: {
            'participants.kf_id': {
              aggs: { rn: { reverse_nested: {} } },
              terms: { field: 'participants.kf_id', size: 300000 },
            },
          },
        },
      },
    },
  };
  const actualOutput = buildAggregations(input);
  expect(actualOutput).toEqual(expectedOutput);
});
