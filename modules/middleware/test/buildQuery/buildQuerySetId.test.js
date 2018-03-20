import buildQuery from '../../src/buildQuery';
test.skip('buildQuery sets', () => {
  const nestedFields = ['files', 'files.foo'];

  const tests = [
    {
      input: {
        nestedFields,
        filters: {
          content: { field: 'case_id', value: ['set_id:aaa'] },
          op: 'in',
        },
      },
      output: {
        terms: {
          case_id: {
            index: 'case_set',
            type: 'case_set',
            id: 'aaa',
            path: 'ids',
          },
          boost: 0,
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: { field: 'ssms.ssm_id', value: ['set_id:aaa'] },
          op: 'in',
        },
      },
      output: {
        terms: {
          'gene.ssm.ssm_id': {
            index: 'ssm_set',
            type: 'ssm_set',
            id: 'aaa',
            path: 'ids',
          },
          boost: 0,
        },
      },
    },
    {
      input: {
        nestedFields,
        filters: {
          content: { field: 'files.file_id', value: ['set_id:aaa'] },
          op: 'in',
        },
      },
      output: {
        nested: {
          path: 'files',
          query: {
            bool: {
              must: [
                {
                  terms: {
                    'files.file_id': {
                      index: 'file_set',
                      type: 'file_set',
                      id: 'aaa',
                      path: 'ids',
                    },
                    boost: 0,
                  },
                },
              ],
            },
          },
        },
      },
    },
  ];

  tests.forEach(({ input, output }) => {
    const actualOutput = buildQuery(input);
    expect(actualOutput).toEqual(output);
  });
});
