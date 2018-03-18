import buildQuery from '../../src/buildQuery';

test('buildQuery nested', () => {
  const nestedFields = ['files', 'files.foo', 'files.foo.bar', 'files.nn.baz'];
  const tests = [
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.data_subtype',
                value: 'Copy number segmentation',
              },
              op: '=',
            },
            {
              content: [
                {
                  content: {
                    field: 'files.experimental_strategy',
                    value: 'WGS',
                  },
                  op: '=',
                },
                {
                  content: {
                    field: 'project.project_id',
                    value: 'TCGA-BRCA',
                  },
                  op: '=',
                },
              ],
              op: 'and',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        terms: {
                          'files.data_subtype': ['Copy number segmentation'],
                          boost: 0,
                        },
                      },
                      {
                        terms: {
                          boost: 0,
                          'files.experimental_strategy': ['WGS'],
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
            { terms: { 'project.project_id': ['TCGA-BRCA'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.data_subtype',
                value: 'Copy number segmentation',
              },
              op: '=',
            },
            {
              content: {
                field: 'files.experimental_strategy',
                value: 'WGS',
              },
              op: '=',
            },
            {
              content: {
                field: 'project.project_id',
                value: 'TCGA-BRCA',
              },
              op: '=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        terms: {
                          'files.data_subtype': ['Copy number segmentation'],
                          boost: 0,
                        },
                      },
                      {
                        terms: {
                          boost: 0,
                          'files.experimental_strategy': ['WGS'],
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
            { terms: { 'project.project_id': ['TCGA-BRCA'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            { content: { field: 'files.access', value: 'open' }, op: '=' },
            {
              content: [
                {
                  content: { field: 'files.center.code', value: '01' },
                  op: '=',
                },
                {
                  content: {
                    field: 'project.primary_site',
                    value: 'Brain',
                  },
                  op: '=',
                },
              ],
              op: 'and',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      { terms: { boost: 0, 'files.access': ['open'] } },
                      { terms: { boost: 0, 'files.center.code': ['01'] } },
                    ],
                  },
                },
                path: 'files',
              },
            },
            { terms: { 'project.primary_site': ['Brain'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: { field: 'files.access', value: 'protected' },
              op: '!=',
            },
            {
              content: [
                {
                  content: { field: 'files.center.code', value: '01' },
                  op: '=',
                },
                {
                  content: {
                    field: 'project.primary_site',
                    value: 'Brain',
                  },
                  op: '=',
                },
              ],
              op: 'and',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must_not: [
                      { terms: { boost: 0, 'files.access': ['protected'] } },
                    ],
                    must: [
                      { terms: { boost: 0, 'files.center.code': ['01'] } },
                    ],
                  },
                },
                path: 'files',
              },
            },
            { terms: { 'project.primary_site': ['Brain'], boost: 0 } },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: { field: 'files.access', value: 'protected4' },
              op: '=',
            },
            {
              content: [
                {
                  content: { field: 'files.center.code', value: '04' },
                  op: '!=',
                },
              ],
              op: 'and',
            },
          ],

          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must_not: [
                      {
                        terms: {
                          boost: 0,
                          'files.center.code': ['04'],
                        },
                      },
                    ],
                    must: [
                      {
                        terms: {
                          boost: 0,
                          'files.access': ['protected4'],
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.access',
                value: 'protected',
              },
              op: '=',
            },
            {
              content: [
                {
                  content: {
                    field: 'files.center.code',
                    value: '01',
                  },
                  op: '!=',
                },
                {
                  content: {
                    field: 'project.primary_site',
                    value: 'Brain',
                  },
                  op: '=',
                },
              ],
              op: 'and',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must_not: [
                      {
                        terms: {
                          boost: 0,
                          'files.center.code': ['01'],
                        },
                      },
                    ],
                    must: [
                      {
                        terms: {
                          boost: 0,
                          'files.access': ['protected'],
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
            {
              terms: {
                'project.primary_site': ['Brain'],
                boost: 0,
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.foo.name',
                value: 'cname',
              },
              op: '=',
            },
            {
              content: {
                field: 'files.foo.code',
                value: '01',
              },
              op: '=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must: [
                                {
                                  terms: {
                                    'files.foo.name': ['cname'],
                                    boost: 0,
                                  },
                                },
                                {
                                  terms: {
                                    boost: 0,
                                    'files.foo.code': ['01'],
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.foo.name',
                value: 'cname',
              },
              op: '=',
            },
            {
              content: {
                field: 'files.foo.code',
                value: '01',
              },
              op: '!=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must_not: [
                                {
                                  terms: {
                                    boost: 0,
                                    'files.foo.code': ['01'],
                                  },
                                },
                              ],
                              must: [
                                {
                                  terms: {
                                    'files.foo.name': ['cname'],
                                    boost: 0,
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.foo.name',
                value: 'cname',
              },
              op: '!=',
            },
            {
              content: {
                field: 'files.foo.code',
                value: '01',
              },
              op: '=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must_not: [
                                {
                                  terms: {
                                    'files.foo.name': ['cname'],
                                    boost: 0,
                                  },
                                },
                              ],
                              must: [
                                {
                                  terms: {
                                    boost: 0,
                                    'files.foo.code': ['01'],
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.foo.name',
                value: 'cname',
              },
              op: '!=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must_not: [
                                {
                                  terms: {
                                    'files.foo.name': ['cname'],
                                    boost: 0,
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: {
            field: 'files.foo.code',
            value: ['01'],
          },
          op: 'not-in',
        },
      },
      output: {
        nested: {
          query: {
            bool: {
              must: [
                {
                  nested: {
                    query: {
                      bool: {
                        must_not: [
                          {
                            terms: {
                              boost: 0,
                              'files.foo.code': ['01'],
                            },
                          },
                        ],
                      },
                    },
                    path: 'files.foo',
                  },
                },
              ],
            },
          },
          path: 'files',
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.foo.name',
                value: 7,
              },
              op: '>=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must: [
                                {
                                  range: {
                                    'files.foo.name': {
                                      boost: 0,
                                      gte: 7,
                                    },
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.foo.bar.name',
                value: 'cname',
              },
              op: '=',
            },
            {
              content: {
                field: 'files.foo.bar.code',
                value: '01',
              },
              op: '=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must: [
                                {
                                  nested: {
                                    query: {
                                      bool: {
                                        must: [
                                          {
                                            terms: {
                                              'files.foo.bar.name': ['cname'],
                                              boost: 0,
                                            },
                                          },
                                          {
                                            terms: {
                                              boost: 0,
                                              'files.foo.bar.code': ['01'],
                                            },
                                          },
                                        ],
                                      },
                                    },
                                    path: 'files.foo.bar',
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: { field: 'files.foo.bar.name', value: 'cname' },
              op: '!=',
            },
            {
              content: { field: 'files.foo.bar.code', value: '01' },
              op: '=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must: [
                                {
                                  nested: {
                                    query: {
                                      bool: {
                                        must_not: [
                                          {
                                            terms: {
                                              'files.foo.bar.name': ['cname'],
                                              boost: 0,
                                            },
                                          },
                                        ],
                                        must: [
                                          {
                                            terms: {
                                              boost: 0,
                                              'files.foo.bar.code': ['01'],
                                            },
                                          },
                                        ],
                                      },
                                    },
                                    path: 'files.foo.bar',
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: { field: 'files.nn.baz.name', value: 'cname' },
              op: '!=',
            },
            {
              content: { field: 'files.code', value: 'beep' },
              op: '=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must_not: [
                                {
                                  terms: {
                                    'files.nn.baz.name': ['cname'],
                                    boost: 0,
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.nn.baz',
                        },
                      },
                      { terms: { 'files.code': ['beep'], boost: 0 } },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.data_category',
                value: ['Simple Nucleotide Variation'],
              },
              op: 'in',
            },
            {
              content: { field: 'files.experimental_strategy', value: ['WXS'] },
              op: 'in',
            },
            {
              content: {
                field: 'files.analysis.metadata.read_groups.is_paired_end',
                value: true,
              },
              op: 'missing',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        terms: {
                          boost: 0,
                          'files.data_category': [
                            'Simple Nucleotide Variation',
                          ],
                        },
                      },
                      {
                        terms: {
                          boost: 0,
                          'files.experimental_strategy': ['WXS'],
                        },
                      },
                    ],
                    must_not: [
                      {
                        exists: {
                          field:
                            'files.analysis.metadata.read_groups.is_paired_end',
                          boost: 0,
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: {
                field: 'files.data_category',
                value: ['Simple Nucleotide Variation'],
              },
              op: 'in',
            },
            {
              content: { field: 'files.experimental_strategy', value: ['WXS'] },
              op: 'in',
            },
            {
              content: {
                field: 'files.analysis.metadata.read_groups.is_paired_end',
                value: false,
              },
              op: 'missing',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        terms: {
                          boost: 0,
                          'files.data_category': [
                            'Simple Nucleotide Variation',
                          ],
                        },
                      },
                      {
                        terms: {
                          boost: 0,
                          'files.experimental_strategy': ['WXS'],
                        },
                      },
                      {
                        exists: {
                          field:
                            'files.analysis.metadata.read_groups.is_paired_end',
                          boost: 0,
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: { field: 'files.foo.code', value: ['01'] },
          op: 'some-not-in',
        },
      },
      output: {
        bool: {
          must_not: [
            {
              nested: {
                path: 'files',
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          path: 'files.foo',
                          query: {
                            bool: {
                              must: [
                                {
                                  terms: { boost: 0, 'files.foo.code': ['01'] },
                                },
                              ],
                            },
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
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            {
              content: { field: 'files.foo.bar.name', value: ['cname'] },
              op: 'some-not-in',
            },
            {
              content: { field: 'files.foo.bar.code', value: '01' },
              op: '=',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must_not: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must: [
                                {
                                  nested: {
                                    query: {
                                      bool: {
                                        must: [
                                          {
                                            terms: {
                                              'files.foo.bar.name': ['cname'],
                                              boost: 0,
                                            },
                                          },
                                        ],
                                      },
                                    },
                                    path: 'files.foo.bar',
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
              },
            },
          ],
          must: [
            {
              nested: {
                query: {
                  bool: {
                    must: [
                      {
                        nested: {
                          query: {
                            bool: {
                              must: [
                                {
                                  nested: {
                                    query: {
                                      bool: {
                                        must: [
                                          {
                                            terms: {
                                              boost: 0,
                                              'files.foo.bar.code': ['01'],
                                            },
                                          },
                                        ],
                                      },
                                    },
                                    path: 'files.foo.bar',
                                  },
                                },
                              ],
                            },
                          },
                          path: 'files.foo',
                        },
                      },
                    ],
                  },
                },
                path: 'files',
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
