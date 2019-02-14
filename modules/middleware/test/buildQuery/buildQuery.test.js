import buildQuery from '../../src/buildQuery';
test('buildQuery "and" and "or" ops', () => {
  const tests = [
    {
      input: {
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'in',
              content: { field: 'project_code', value: ['ACC'] },
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
        nestedFields: [],
        filters: {
          op: 'or',
          content: [
            {
              op: 'in',
              content: { field: 'project_code', value: ['ACC'] },
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
        nestedFields: [],
        filters: {
          op: 'or',
          content: [
            {
              op: 'in',
              content: { field: 'project_code', value: ['__missing__'] },
            },
          ],
        },
      },
      output: {
        bool: {
          should: [
            {
              bool: {
                must_not: [{ exists: { boost: 0, field: 'project_code' } }],
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

test('buildQuery "and", "or" ops nested inside each other', () => {
  const tests = [
    {
      input: {
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'or',
              content: [
                {
                  op: 'in',
                  content: { field: 'project_code', value: ['ACC'] },
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
        nestedFields: [],
        filters: {
          op: '=',
          content: { field: 'project_code', value: ['ACC'] },
        },
      },
      output: { terms: { project_code: ['ACC'], boost: 0 } },
    },
    {
      input: {
        nestedFields: [],
        filters: {
          op: '!=',
          content: {
            field: 'project_code',
            value: 'ACC',
          },
        },
      },
      output: {
        bool: { must_not: [{ terms: { project_code: ['ACC'], boost: 0 } }] },
      },
    },
    {
      input: {
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '=',
              content: {
                field: 'program',
                value: ['TCGA'],
              },
            },
            {
              op: '=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '=',
              content: {
                field: 'program',
                value: ['TCGA'],
              },
            },
            {
              op: '!=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                {
                  op: '=',
                  content: {
                    field: 'program',
                    value: ['TCGA'],
                  },
                },
                {
                  op: '=',
                  content: {
                    field: 'project',
                    value: ['ACC'],
                  },
                },
              ],
            },
            {
              op: '=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                {
                  op: '=',
                  content: {
                    field: 'program',
                    value: ['TCGA'],
                  },
                },
                {
                  op: '=',
                  content: {
                    field: 'project',
                    value: ['ACC'],
                  },
                },
              ],
            },
            {
              op: '!=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                {
                  op: '=',
                  content: {
                    field: 'program',
                    value: ['TCGA'],
                  },
                },
                {
                  op: '!=',
                  content: {
                    field: 'project',
                    value: ['ACC'],
                  },
                },
              ],
            },
            {
              op: '=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'and',
              content: [
                {
                  op: '=',
                  content: {
                    field: 'program',
                    value: ['TCGA'],
                  },
                },
                {
                  op: '!=',
                  content: {
                    field: 'project',
                    value: ['ACC'],
                  },
                },
              ],
            },
            {
              op: '!=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
          ],
        },
      },
      output: {
        bool: {
          must: [
            { terms: { program: ['TCGA'], boost: 0 } },
            {
              bool: {
                must_not: [
                  { terms: { project: ['ACC'], boost: 0 } },
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
        nestedFields: [],
        filters: {
          op: 'or',
          content: [
            {
              op: '=',
              content: {
                field: 'program',
                value: ['TCGA'],
              },
            },
            {
              op: '=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
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
        nestedFields: [],
        filters: {
          op: 'or',
          content: [
            {
              op: '=',
              content: {
                field: 'program',
                value: ['TCGA'],
              },
            },
            {
              op: '!=',
              content: {
                field: 'status',
                value: ['legacy'],
              },
            },
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
        nestedFields: [],
        filters: {
          op: 'or',
          content: [
            {
              op: '=',
              content: {
                field: 'project',
                value: ['ACC'],
              },
            },
            {
              op: 'and',
              content: [
                {
                  op: '=',
                  content: {
                    field: 'program',
                    value: ['TCGA'],
                  },
                },
                {
                  op: '=',
                  content: {
                    field: 'status',
                    value: ['legacy'],
                  },
                },
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '!=',
              content: { field: 'access', value: 'protected' },
            },
            {
              op: 'and',
              content: [
                {
                  op: '=',
                  content: { field: 'center.code', value: '01' },
                },
                {
                  op: '=',
                  content: {
                    field: 'cases.project.primary_site',
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
        nestedFields: [],
        filters: {
          op: '=',
          content: {
            field: 'is_canonical',
            value: [true],
          },
        },
      },
      output: { terms: { is_canonical: [true], boost: 0 } },
    },
    {
      input: {
        nestedFields: [],
        filters: {
          op: '=',
          content: {
            field: 'case_count',
            value: [24601],
          },
        },
      },
      output: { terms: { case_count: [24601], boost: 0 } },
    },
  ];

  tests.forEach(({ input, output }) => {
    const actualOutput = buildQuery(input);
    expect(actualOutput).toEqual(output);
  });
});

test('buildQuery "<=" and "=>"', () => {
  const tests = [
    {
      input: {
        nestedFields: [],
        filters: {
          op: '<=',
          content: {
            field: 'cases.clinical.age_at_diagnosis',
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '<=',
              content: {
                field: 'cases.clinical.age_at_diagnosis',
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '<=',
              content: {
                field: 'cases.clinical.age_at_diagnosis',
                value: ['30'],
              },
            },
            {
              op: '>=',
              content: {
                field: 'cases.clinical.age_at_diagnosis',
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '<=',
              content: {
                field: 'cases.clinical.age_at_diagnosis',
                value: ['30'],
              },
            },
            {
              op: '>=',
              content: {
                field: 'cases.clinical.age_at_diagnosis',
                value: ['20'],
              },
            },
            {
              op: '>=',
              content: {
                field: 'cases.clinical.days_to_death',
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '>=',
              content: {
                field: 'cases.clinical.date_of_birth',
                value: ['2017-01-01'],
              },
            },
            {
              op: '<=',
              content: {
                field: 'cases.clinical.date_of_birth',
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
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: '>=',
              content: {
                field: 'cases.clinical.date_of_birth',
                value: ['2017-01-01 00:00:00.000000'],
              },
            },
            {
              op: '<=',
              content: {
                field: 'cases.clinical.date_of_birth',
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
    nestedFields: [
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
            field: 'files.kf_id',
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
                      must: [
                        { terms: { 'files.kf_id': ['GF_JBMG9T1M'], boost: 0 } },
                        { terms: { 'files.kf_id': ['GF_WCYF2AH4'], boost: 0 } },
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
  };
  expect(buildQuery(input)).toEqual(output);
});
