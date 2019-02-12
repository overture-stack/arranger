import normalizeFilters from '../../src/buildQuery/normalizeFilters';

test(`it must handle "all" op`, () => {
  const input = {
    op: 'and',
    content: [
      {
        op: 'all',
        content: {
          field: 'some_field',
          value: ['val1', 'val2', 'val3'],
        },
      },
    ],
  };
  const output = {
    op: 'and',
    content: [
      {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'some_field',
              value: ['val1'],
            },
          },
          {
            op: 'in',
            content: {
              field: 'some_field',
              value: ['val2'],
            },
          },
          {
            op: 'in',
            content: {
              field: 'some_field',
              value: ['val3'],
            },
          },
        ],
      },
    ],
  };
  expect(normalizeFilters(input)).toEqual(output);
});

test(`it must optimize properly`, () => {
  const input = {
    op: 'and',
    content: [
      {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'some_field',
              value: ['val3'],
            },
          },
          {
            op: 'or',
            content: [
              {
                op: 'in',
                content: {
                  field: 'some_field',
                  value: ['val3'],
                },
              },
              {
                op: 'and',
                content: [
                  {
                    op: 'in',
                    content: {
                      field: 'some_field',
                      value: ['val3'],
                    },
                  },
                  {
                    op: 'and',
                    content: [
                      {
                        op: 'in',
                        content: {
                          field: 'some_field',
                          value: ['val3'],
                        },
                      },
                      {
                        op: 'and',
                        content: [
                          {
                            op: 'all',
                            content: {
                              field: 'some_field',
                              value: ['val3', 'val3', 'val3'],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const output = {
    op: 'and',
    content: [
      {
        op: 'in',
        content: {
          field: 'some_field',
          value: ['val3'],
        },
      },
      {
        op: 'or',
        content: [
          {
            op: 'in',
            content: {
              field: 'some_field',
              value: ['val3'],
            },
          },
          {
            op: 'and',
            content: [
              {
                op: 'in',
                content: {
                  field: 'some_field',
                  value: ['val3'],
                },
              },
              {
                op: 'in',
                content: {
                  field: 'some_field',
                  value: ['val3'],
                },
              },
              {
                op: 'and',
                content: [
                  {
                    op: 'in',
                    content: {
                      field: 'some_field',
                      value: ['val3'],
                    },
                  },
                  {
                    op: 'in',
                    content: {
                      field: 'some_field',
                      value: ['val3'],
                    },
                  },
                  {
                    op: 'in',
                    content: {
                      field: 'some_field',
                      value: ['val3'],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  expect(normalizeFilters(input)).toEqual(output);
});
