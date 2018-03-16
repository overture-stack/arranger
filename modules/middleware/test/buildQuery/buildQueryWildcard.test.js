import buildQuery from '../../src/buildQuery';
test('buildQuery nested', () => {
  const nestedFields = ['files', 'files.foo'];

  const tests = [
    {
      input: {
        nestedFields,
        filters: {
          content: { field: 'case_id', value: ['006*'] },
          op: 'in',
        },
      },
      output: { regexp: { case_id: '006.*' } },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            { content: { field: 'case_id', value: ['006*'] }, op: 'in' },
          ],
          op: 'and',
        },
      },
      output: { bool: { must: [{ regexp: { case_id: '006.*' } }] } },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: { field: 'case_id', value: ['006*', 'v1'] },
          op: 'in',
        },
      },
      output: {
        bool: {
          should: [
            { terms: { case_id: ['v1'], boost: 0 } },
            { regexp: { case_id: '006.*' } },
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
              content: { field: 'case_id', value: ['006*', 'v1'] },
              op: 'in',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  { terms: { case_id: ['v1'], boost: 0 } },
                  { regexp: { case_id: '006.*' } },
                ],
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
              content: { field: 'case_id', value: ['006*', 'v1'] },
              op: 'in',
            },
            {
              content: {
                field: 'project.primary_site',
                value: ['Brain'],
              },
              op: 'in',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  { terms: { case_id: ['v1'], boost: 0 } },
                  { regexp: { case_id: '006.*' } },
                ],
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
            { content: { field: 'files.foo.name', value: 'cname*' }, op: '=' },
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
                                { regexp: { 'files.foo.name': 'cname.*' } },
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
                value: ['*cname', 'cn*me', 'cname*'],
              },
              op: 'in',
            },
          ],
          op: 'and',
        },
      },
      output: {
        bool: {
          must: [
            {
              bool: {
                should: [
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
                                        regexp: { 'files.foo.name': '.*cname' },
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
                                        regexp: { 'files.foo.name': 'cn.*me' },
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
                                        regexp: { 'files.foo.name': 'cname.*' },
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
          ],
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: [
            { content: { field: 'files.foo.name1', value: '*cname' }, op: '=' },
            { content: { field: 'files.foo.name2', value: 'cn*me' }, op: '=' },
            { content: { field: 'files.foo.name3', value: 'cname*' }, op: '=' },
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
                                { regexp: { 'files.foo.name1': '.*cname' } },
                                { regexp: { 'files.foo.name2': 'cn.*me' } },
                                { regexp: { 'files.foo.name3': 'cname.*' } },
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
