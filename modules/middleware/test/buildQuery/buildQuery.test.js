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

test('buildQuery missing', () => {
  const tests = [
    {
      input: {
        nestedFields: [],
        filters: {
          op: 'missing',
          content: {
            field: 'cases.clinical.gender',
            value: false,
          },
        },
      },
      output: { exists: { boost: 0, field: 'cases.clinical.gender' } },
    },
    {
      input: {
        nestedFields: [],
        filters: {
          op: 'and',
          content: [
            {
              op: 'missing',
              content: {
                field: 'cases.clinical.gender',
                value: true,
              },
            },
            {
              op: 'missing',
              content: {
                field: 'cases.clinical.gender',
                value: false,
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
                must_not: [
                  { exists: { boost: 0, field: 'cases.clinical.gender' } },
                ],
              },
            },
            { exists: { boost: 0, field: 'cases.clinical.gender' } },
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
              op: 'missing',
              content: {
                field: 'cases.clinical.gender',
                value: true,
              },
            },
            {
              op: 'missing',
              content: {
                field: 'cases.clinical.gender',
                value: false,
              },
            },
          ],
        },
      },
      output: {
        bool: {
          should: [
            {
              bool: {
                must_not: [
                  { exists: { boost: 0, field: 'cases.clinical.gender' } },
                ],
              },
            },
            { exists: { boost: 0, field: 'cases.clinical.gender' } },
          ],
        },
      },
    },
    {
      input: {
        nestedFields: [],
        filters: {
          op: 'missing',
          content: {
            field: 'cases.clinical.gender',
            value: true,
          },
        },
      },
      output: {
        bool: {
          must_not: [{ exists: { boost: 0, field: 'cases.clinical.gender' } }],
        },
      },
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
  ];

  tests.forEach(({ input, output }) => {
    const actualOutput = buildQuery(input);
    expect(actualOutput).toEqual(output);
  });
});
