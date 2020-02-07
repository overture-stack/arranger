import buildQuery from '../../src/buildQuery';
test('buildQuery filter', () => {
  const nestedFields = ['files', 'files.foo'];

  const tests = [
    {
      input: {
        nestedFields,
        filters: {
          content: { fields: ['files.foo', 'test'], value: '*v*' },
          op: 'filter',
        },
      },
      output: {
        bool: {
          should: [
            {
              nested: {
                path: 'files',
                query: {
                  bool: {
                    should: [
                      {
                        wildcard: {
                          ['files.foo']: {
                            value: '*v*',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              bool: {
                should: [
                  {
                    wildcard: {
                      ['test']: {
                        value: '*v*',
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
    expect(actualOutput).toEqual(output);
  });
});
