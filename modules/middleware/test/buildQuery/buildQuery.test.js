import buildQuery from '../../src/buildQuery';

test('buildQuery', () => {
  const tests = [
    {
      input: {
        nestedFields: [],
        filters: {
          op: '=',
          content: {
            field: 'project_code',
            value: ['ACC'],
          },
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
          must: [{ terms: { program: ['TCGA'], boost: 0 } }],
          must_not: [{ terms: { status: ['legacy'], boost: 0 } }],
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
          ],
          must_not: [{ terms: { status: ['legacy'], boost: 0 } }],
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
            { terms: { status: ['legacy'], boost: 0 } },
          ],
          must_not: [{ terms: { project: ['ACC'], boost: 0 } }],
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
          must: [{ terms: { program: ['TCGA'], boost: 0 } }],
          must_not: [
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
          op: 'not',
          content: {
            field: 'cases.clinical.gender',
            value: 'missing',
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
              op: 'is',
              content: {
                field: 'cases.clinical.gender',
                value: 'missing',
              },
            },
            {
              op: 'not',
              content: {
                field: 'cases.clinical.gender',
                value: 'missing',
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
              op: 'is',
              content: {
                field: 'cases.clinical.gender',
                value: 'missing',
              },
            },
            {
              op: 'not',
              content: {
                field: 'cases.clinical.gender',
                value: 'missing',
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
          must_not: [{ terms: { access: ['protected'], boost: 0 } }],
          must: [
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
    {
      input: {
        nestedFields: [],
        filters: {
          op: 'is',
          content: {
            field: 'cases.clinical.gender',
            value: 'missing',
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
