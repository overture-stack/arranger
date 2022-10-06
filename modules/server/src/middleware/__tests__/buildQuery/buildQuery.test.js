import buildQuery from '../../buildQuery';

test('buildQuery should handle empty sqon', () => {
  expect(
    buildQuery({
      nestedFieldNames: [],
      filters: {
        op: 'and',
        content: [],
      },
    }),
  ).toEqual({ bool: { must: [] } });
});

test('buildQuery "and" and "or" ops', () => {
  const tests = [
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'in',
              content: { fieldName: 'project_code', value: ['ACC'] },
            },
          ],
        },
      },
      output: {
        bool: { must: [{ terms: { boost: 0, project_code: ['ACC'] } }] },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'or',
          content: [
            {
              op: 'in',
              content: { fieldName: 'project_code', value: ['ACC'] },
            },
          ],
        },
      },
      output: {
        bool: { should: [{ terms: { boost: 0, project_code: ['ACC'] } }] },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'or',
          content: [
            {
              op: 'in',
              content: { fieldName: 'project_code', value: ['__missing__'] },
            },
          ],
        },
      },
      output: {
        bool: {
          should: [
            {
              bool: {
                must_not: [{ exists: { boost: 0, fieldName: 'project_code' } }],
              },
            },
          ],
        },
      },
    },
  ];

  tests.forEach(({ input, output }) => {
    const actualOutput = buildQuery(input);
    expect(actualOutput).toEqual(output);
  });
});

test('buildQuery "all" ops', () => {
  const tests = [
    {
      input: {
        nestedFieldNames: ['diagnoses'],
        filters: {
          op: 'and',
          content: [
            {
              op: 'all',
              content: {
                fieldName: 'diagnoses.diagnosis',
                value: ['ganglioglioma', 'low grade glioma'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              bool: {
                must: [
                  {
                    nested: {
                      path: 'diagnoses',
                      query: {
                        bool: {
                          must: [
                            {
                              terms: {
                                'diagnoses.diagnosis': ['ganglioglioma'],
                                boost: 0,
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                  {
                    nested: {
                      path: 'diagnoses',
                      query: {
                        bool: {
                          must: [
                            {
                              terms: {
                                'diagnoses.diagnosis': ['low grade glioma'],
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
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: ['diagnoses'],
        filters: {
          op: 'and',
          content: [
            {
              op: 'all',
              pivot: 'diagnoses',
              content: {
                fieldName: 'diagnoses.diagnosis',
                value: ['ganglioglioma', 'low grade glioma'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              bool: {
                must: [
                  {
                    nested: {
                      path: 'diagnoses',
                      query: {
                        bool: {
                          must: [
                            {
                              terms: {
                                'diagnoses.diagnosis': ['ganglioglioma'],
                                boost: 0,
                              },
                            },
                            {
                              terms: {
                                'diagnoses.diagnosis': ['low grade glioma'],
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
          ],
        },
      },
    },
  ];
  tests.forEach(({ input, output }) => {
    const actualOutput = buildQuery(input);
    console.log('actualOutput: ', JSON.stringify(actualOutput));
    expect(actualOutput).toEqual(output);
  });
});

test('buildQuery "and", "or" ops nested inside each other', () => {
  const tests = [
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'or',
              content: [
                {
                  op: 'in',
                  content: { fieldName: 'project_code', value: ['ACC'] },
                },
              ],
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              bool: {
                should: [{ terms: { boost: 0, project_code: ['ACC'] } }],
              },
            },
          ],
        },
      },
    },
  ];

  tests.forEach(({ input, output }) => {
    const actualOutput = buildQuery(input);
    expect(actualOutput).toEqual(output);
  });
});

test('buildQuery "=" and "!=" ops', () => {
  const tests = [
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: '=',
          content: { fieldName: 'project_code', value: ['ACC'] },
        },
      },
      output: { terms: { project_code: ['ACC'], boost: 0 } },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: { op: '!=', content: { fieldName: 'project_code', value: 'ACC' } },
      },
      output: {
        bool: { must_not: [{ terms: { project_code: ['ACC'], boost: 0 } }] },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
            { op: '=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          must: [
            { terms: { program: ['TCGA'], boost: 0 } },
            { terms: { status: ['legacy'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
            { op: '!=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          must: [
            { terms: { program: ['TCGA'], boost: 0 } },
            {
              bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
                { op: '=', content: { fieldName: 'project', value: ['ACC'] } },
              ],
            },
            { op: '=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          must: [
            { terms: { program: ['TCGA'], boost: 0 } },
            { terms: { project: ['ACC'], boost: 0 } },
            { terms: { status: ['legacy'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
                { op: '=', content: { fieldName: 'project', value: ['ACC'] } },
              ],
            },
            { op: '!=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          must: [
            { terms: { program: ['TCGA'], boost: 0 } },
            { terms: { project: ['ACC'], boost: 0 } },
            {
              bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
                { op: '!=', content: { fieldName: 'project', value: ['ACC'] } },
              ],
            },
            { op: '=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          must: [
            { terms: { program: ['TCGA'], boost: 0 } },
            { bool: { must_not: [{ terms: { project: ['ACC'], boost: 0 } }] } },
            { terms: { status: ['legacy'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
                { op: '!=', content: { fieldName: 'project', value: ['ACC'] } },
              ],
            },
            { op: '!=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          must: [
            { terms: { program: ['TCGA'], boost: 0 } },
            { bool: { must_not: [{ terms: { project: ['ACC'], boost: 0 } }] } },
            {
              bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'or',
          content: [
            { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
            { op: '=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          should: [
            { terms: { program: ['TCGA'], boost: 0 } },
            { terms: { status: ['legacy'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'or',
          content: [
            { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
            { op: '!=', content: { fieldName: 'status', value: ['legacy'] } },
          ],
        },
      },
      output: {
        bool: {
          should: [
            { terms: { program: ['TCGA'], boost: 0 } },
            {
              bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'or',
          content: [
            { op: '=', content: { fieldName: 'project', value: ['ACC'] } },
            {
              op: 'and',
              content: [
                { op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
                { op: '=', content: { fieldName: 'status', value: ['legacy'] } },
              ],
            },
          ],
        },
      },
      output: {
        bool: {
          should: [
            { terms: { project: ['ACC'], boost: 0 } },
            {
              bool: {
                must: [
                  { terms: { program: ['TCGA'], boost: 0 } },
                  { terms: { status: ['legacy'], boost: 0 } },
                ],
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            { op: '!=', content: { fieldName: 'access', value: 'protected' } },
            {
              op: 'and',
              content: [
                { op: '=', content: { fieldName: 'center.code', value: '01' } },
                {
                  op: '=',
                  content: {
                    fieldName: 'cases.project.primary_site',
                    value: 'Brain',
                  },
                },
              ],
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              bool: {
                must_not: [{ terms: { access: ['protected'], boost: 0 } }],
              },
            },
            { terms: { 'center.code': ['01'], boost: 0 } },
            { terms: { 'cases.project.primary_site': ['Brain'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: { op: '=', content: { fieldName: 'is_canonical', value: [true] } },
      },
      output: { terms: { is_canonical: [true], boost: 0 } },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: { op: '=', content: { fieldName: 'case_count', value: [24601] } },
      },
      output: { terms: { case_count: [24601], boost: 0 } },
    },
  ];

  tests.forEach(({ input, output }, i) => {
    const actualOutput = buildQuery(input);
    expect(actualOutput).toEqual(output);
  });
});

test('buildQuery "<=" and "=>"', () => {
  const tests = [
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: '<=',
          content: {
            fieldName: 'cases.clinical.age_at_diagnosis',
            value: ['20'],
          },
        },
      },
      output: {
        range: { 'cases.clinical.age_at_diagnosis': { lte: '20', boost: 0 } },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '<=',
              content: {
                fieldName: 'cases.clinical.age_at_diagnosis',
                value: ['20'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              range: {
                'cases.clinical.age_at_diagnosis': { lte: '20', boost: 0 },
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '<=',
              content: {
                fieldName: 'cases.clinical.age_at_diagnosis',
                value: ['30'],
              },
            },
            {
              op: '>=',
              content: {
                fieldName: 'cases.clinical.age_at_diagnosis',
                value: ['20'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              range: {
                'cases.clinical.age_at_diagnosis': { lte: '30', boost: 0 },
              },
            },
            {
              range: {
                'cases.clinical.age_at_diagnosis': { gte: '20', boost: 0 },
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '<=',
              content: {
                fieldName: 'cases.clinical.age_at_diagnosis',
                value: ['30'],
              },
            },
            {
              op: '>=',
              content: {
                fieldName: 'cases.clinical.age_at_diagnosis',
                value: ['20'],
              },
            },
            {
              op: '>=',
              content: {
                fieldName: 'cases.clinical.days_to_death',
                value: ['100'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              range: {
                'cases.clinical.age_at_diagnosis': { lte: '30', boost: 0 },
              },
            },
            {
              range: {
                'cases.clinical.age_at_diagnosis': { gte: '20', boost: 0 },
              },
            },
            {
              range: {
                'cases.clinical.days_to_death': { gte: '100', boost: 0 },
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '>=',
              content: {
                fieldName: 'cases.clinical.date_of_birth',
                value: ['2017-01-01'],
              },
            },
            {
              op: '<=',
              content: {
                fieldName: 'cases.clinical.date_of_birth',
                value: ['2017-12-01'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              range: {
                'cases.clinical.date_of_birth': {
                  gte: '2017-01-01 00:00:00.000000',
                  boost: 0,
                },
              },
            },
            {
              range: {
                'cases.clinical.date_of_birth': {
                  lte: '2017-12-01 00:00:00.000000',
                  boost: 0,
                },
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFieldNames: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '>=',
              content: {
                fieldName: 'cases.clinical.date_of_birth',
                value: ['2017-01-01 00:00:00.000000'],
              },
            },
            {
              op: '<=',
              content: {
                fieldName: 'cases.clinical.date_of_birth',
                value: ['2017-12-01 00:00:00.000000'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            {
              range: {
                'cases.clinical.date_of_birth': {
                  gte: '2017-01-01 00:00:00.000000',
                  boost: 0,
                },
              },
            },
            {
              range: {
                'cases.clinical.date_of_birth': {
                  lte: '2017-12-01 00:00:00.000000',
                  boost: 0,
                },
              },
            },
          ],
        },
      },
    },
  ];

  tests.forEach(({ input, output }) => {
    const actualOutput = buildQuery(input);
    expect(actualOutput).toEqual(output);
  });
});

test('buildQuery "all"', () => {
  const input = {
    nestedFieldNames: [
      'biospecimens',
      'diagnoses',
      'family.family_compositions',
      'family.family_compositions.family_members',
      'family.family_compositions.family_members.diagnoses',
      'files',
      'files.sequencing_experiments',
    ],
    filters: {
      op: 'and',
      content: [
        {
          op: 'all',
          content: {
            fieldName: 'files.kf_id',
            value: ['GF_JBMG9T1M', 'GF_WCYF2AH4'],
          },
        },
      ],
    },
  };
  const output = {
    bool: {
      must: [
        {
          bool: {
            must: [
              {
                nested: {
                  path: 'files',
                  query: {
                    bool: {
                      must: [{ terms: { 'files.kf_id': ['GF_JBMG9T1M'], boost: 0 } }],
                    },
                  },
                },
              },
              {
                nested: {
                  path: 'files',
                  query: {
                    bool: {
                      must: [{ terms: { 'files.kf_id': ['GF_WCYF2AH4'], boost: 0 } }],
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
  const actualOutput = buildQuery(input);
  expect(actualOutput).toEqual(output);
});

test('buildQuery "between"', () => {
  const input = {
    nestedFieldNames: ['biospecimens'],
    filters: {
      op: 'and',
      content: [
        {
          op: 'between',
          content: {
            fieldName: 'biospecimens.age_at_event_days',
            value: [200, '10000'],
          },
        },
      ],
    },
  };
  const output = {
    bool: {
      must: [
        {
          nested: {
            path: 'biospecimens',
            query: {
              bool: {
                must: [
                  {
                    range: {
                      'biospecimens.age_at_event_days': {
                        boost: 0,
                        gte: 200,
                        lte: '10000',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
  };
  const actualOutput = buildQuery(input);
  expect(actualOutput).toEqual(output);
});

test('buildQuery "not-in" op', () => {
  const input = {
    nestedFieldNames: [],
    filters: {
      op: 'and',
      content: [
        {
          op: 'not-in',
          content: {
            fieldName: 'kf_id',
            value: ['id_1', 'id_2', 'id_3'],
          },
        },
      ],
    },
  };
  const output = {
    bool: {
      must: [
        {
          bool: {
            must_not: [
              {
                terms: {
                  kf_id: ['id_1', 'id_2', 'id_3'],
                  boost: 0,
                },
              },
            ],
          },
        },
      ],
    },
  };
  const actualOutput = buildQuery(input);
  expect(actualOutput).toEqual(output);
});

// we need a way to handle object fields before the following is valid
// test('it must reject invalid pivot fields', () => {
//   const testFunction = () => {
//     const input = {
//       nestedFieldNames: ['files'],
//       filters: {
//         op: 'and',
//         content: [
//           {
//             op: 'all',
//             pivot: 'asdf',
//             content: {
//               fieldName: 'files.kf_id',
//               value: ['GF_JBMG9T1M', 'GF_WCYF2AH4'],
//             },
//           },
//         ],
//       },
//     };
//     return buildQuery(input);
//   };
//   expect(testFunction).toThrow();
// });
