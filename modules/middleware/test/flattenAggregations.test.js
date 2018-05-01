import flattenAggregations from '../src/flattenAggregations.js';

test('flattenAggregations', () => {
  const tests = [
    {
      input: {
        'status:global': {
          'status:filtered': {
            status: {
              buckets: [{ key: 'legacy', doc_count: 34 }],
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
            },
          },
        },
      },
      output: { status: { buckets: [{ key: 'legacy', doc_count: 34 }] } },
    },
    {
      input: {
        'itemType:global': {
          'itemType:filtered': {
            'itemType:missing': { doc_count: 0 },
            itemType: {
              buckets: [
                { key: 'Aliquot', doc_count: 16730 },
                { key: 'Portion', doc_count: 8 },
              ],
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
            },
          },
        },
        'categoryName:global': {
          'categoryName:filtered': {
            'categoryName:missing': { doc_count: 0 },
            categoryName: {
              buckets: [
                { key: 'Item flagged DN', doc_count: 16191 },
                { key: 'Item is noncanonical', doc_count: 2923 },
                { key: 'Sample compromised', doc_count: 2 },
                { key: 'WGA Failure', doc_count: 1 },
              ],
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
            },
          },
        },
      },
      output: {
        categoryName: {
          buckets: [
            { key: 'Item flagged DN', doc_count: 16191 },
            { key: 'Item is noncanonical', doc_count: 2923 },
            { key: 'Sample compromised', doc_count: 2 },
            { key: 'WGA Failure', doc_count: 1 },
          ],
        },
        itemType: {
          buckets: [
            { key: 'Aliquot', doc_count: 16730 },
            { key: 'Portion', doc_count: 8 },
          ],
        },
      },
    },
    {
      input: {
        'status:global': {
          'status:filtered': {
            status: {
              buckets: [{ key: 'legacy', doc_count: 34 }],
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
            },
            'status:missing': { doc_count: 1 },
          },
        },
      },
      output: {
        status: {
          buckets: [
            { key: 'legacy', doc_count: 34 },
            { key: '__missing__', doc_count: 1 },
          ],
        },
      },
    },
    {
      input: {
        'archive.revision:global': {
          'archive.revision:filtered': {
            'status:missing': { doc_count: 0 },
            'archive.revision': {
              buckets: [
                { key: 2002, doc_count: 37860 },
                { key: 0, doc_count: 36684 },
              ],
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
            },
          },
        },
      },
      output: {
        'archive.revision': {
          buckets: [
            { key: 2002, doc_count: 37860 },
            { key: 0, doc_count: 36684 },
          ],
        },
      },
    },
    {
      input: {
        'samples.is_ffpe:global': {
          'samples.is_ffpe:filtered': {
            'samples.is_ffpe:nested': {
              'samples.is_ffpe:missing': {
                rn: { doc_count: 5 },
                doc_count: 3,
              },
              'samples.is_ffpe': {
                buckets: [{ rn: { doc_count: 7 }, key: 'a', doc_count: 7 }],
              },
              doc_count: 123,
            },
            doc_count: 132,
          },
          doc_count: 1234,
        },
      },
      output: {
        'samples.is_ffpe': {
          buckets: [
            { key: 'a', doc_count: 7 },
            { key: '__missing__', doc_count: 5 },
          ],
        },
      },
    },
    {
      input: {
        'samples.portions.amount:global': {
          'samples.portions.amount:filtered': {
            samples: {
              portions: {
                'samples.portions.amount': {
                  buckets: [{ rn: { doc_count: 7 }, key: 'a', doc_count: 7 }],
                },
                'samples.portions.amount:missing': {
                  rn: { doc_count: 5 },
                  doc_count: 3,
                },
                doc_count: 123,
              },
              doc_count: 123,
            },
            doc_count: 132,
          },
          doc_count: 1234,
        },
      },
      output: {
        'samples.portions.amount': {
          buckets: [
            { key: 'a', doc_count: 7 },
            { key: '__missing__', doc_count: 5 },
          ],
        },
      },
    },
    {
      input: {
        'samples.portions.amount:global': {
          'samples.portions.amount:filtered': {
            samples: {
              portions: {
                'samples.portions.amount': {
                  buckets: [{ rn: { doc_count: 7 }, key: 'a', doc_count: 7 }],
                },
                'samples.portions.amount:missing': {
                  rn: { doc_count: 5 },
                  doc_count: 3,
                },
                doc_count: 123,
              },
              'samples.is_ffpe:missing': {
                rn: { doc_count: 5 },
                doc_count: 3,
              },
              'samples.is_ffpe': {
                buckets: [{ rn: { doc_count: 7 }, key: 'a', doc_count: 7 }],
              },
              doc_count: 123,
            },
            doc_count: 132,
          },
          doc_count: 1234,
        },
      },
      output: {
        'samples.portions.amount': {
          buckets: [
            { key: 'a', doc_count: 7 },
            { key: '__missing__', doc_count: 5 },
          ],
        },
        'samples.is_ffpe': {
          buckets: [
            { key: 'a', doc_count: 7 },
            { key: '__missing__', doc_count: 5 },
          ],
        },
      },
    },
    {
      input: {
        'status:global': {
          'status:filtered': {
            status: {
              buckets: [{ key: 'legacy', doc_count: 34 }],
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
            },
            'status:missing': { doc_count: 0 },
          },
        },
        'samples.portions.amount_global': {
          'samples.portions.amount:filtered': {
            samples: {
              'samples.is_ffpe:missing': {
                rn: { doc_count: 5 },
                doc_count: 3,
              },
              portions: {
                'samples.portions.amount': {
                  buckets: [{ rn: { doc_count: 7 }, key: 'a', doc_count: 7 }],
                },
                'samples.portions.amount:missing': {
                  rn: { doc_count: 5 },
                  doc_count: 3,
                },
                doc_count: 123,
              },
              'samples.is_ffpe': {
                buckets: [{ rn: { doc_count: 7 }, key: 'a', doc_count: 7 }],
              },
              doc_count: 123,
            },
            doc_count: 132,
          },
          doc_count: 1234,
        },
      },
      output: {
        status: { buckets: [{ key: 'legacy', doc_count: 34 }] },
        'samples.portions.amount': {
          buckets: [
            { key: 'a', doc_count: 7 },
            { key: '__missing__', doc_count: 5 },
          ],
        },
        'samples.is_ffpe': {
          buckets: [
            { key: 'a', doc_count: 7 },
            { key: '__missing__', doc_count: 5 },
          ],
        },
      },
    },
  ];
  tests.forEach(({ input, output }) => {
    const actualOutput = flattenAggregations({ aggregations: input });
    expect(actualOutput).toEqual(output);
  });
});
