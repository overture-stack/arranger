import buildQuery from '../../src/buildQuery';
test('buildQuery filter', () => {
  const nestedFields = ['files', 'files.foo'];
  const tests = [
    {
      input: {
        nestedFields,
        filters: {
          content: { fields: ['files.foo', 'test'], value: 'v' },
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
                      { prefix: { 'files.foo': 'v' } },
                      {
                        multi_match: {
                          fields: ['files.foo'],
                          query: 'v',
                          type: 'phrase_prefix',
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
                  { prefix: { test: 'v' } },
                  {
                    multi_match: {
                      fields: ['test'],
                      query: 'v',
                      type: 'phrase_prefix',
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
