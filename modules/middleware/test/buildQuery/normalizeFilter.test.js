import normalizeFilters from '../../src/buildQuery/normalizeFilters';
import { IN_OP, OR_OP, AND_OP, ALL_OP } from '../../src/constants';

test(`it must handle "all" op`, () => {
  const input = {
    op: AND_OP,
    content: [
      {
        op: ALL_OP,
        content: {
          field: 'some_field',
          value: ['val1', 'val2', 'val3'],
        },
      },
    ],
  };
  const output = {
    op: AND_OP,
    pivot: null,
    content: [
      {
        op: AND_OP,
        pivot: null,
        content: [
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'some_field',
              value: ['val1'],
            },
          },
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'some_field',
              value: ['val2'],
            },
          },
          {
            op: IN_OP,
            pivot: null,
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

test(`it must preserve pivots`, () => {
  const input = {
    op: AND_OP,
    content: [
      {
        op: IN_OP,
        pivot: 'nested',
        content: {
          field: 'nested.some_field',
          value: ['val1'],
        },
      },
    ],
  };
  const output = {
    op: AND_OP,
    pivot: null,
    content: [
      {
        op: IN_OP,
        pivot: 'nested',
        content: {
          field: 'nested.some_field',
          value: ['val1'],
        },
      },
    ],
  };
  expect(normalizeFilters(input)).toEqual(output);
});

test(`it must handle pivots for "all" op`, () => {
  const input = {
    op: AND_OP,
    content: [
      {
        op: ALL_OP,
        pivot: 'nested.nested1',
        content: {
          field: 'nested.nested1.some_field',
          value: ['val1', 'val2'],
        },
      },
    ],
  };
  const output = {
    op: AND_OP,
    pivot: null,
    content: [
      {
        op: AND_OP,
        pivot: 'nested.nested1',
        content: [
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'nested.nested1.some_field',
              value: ['val1'],
            },
          },
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'nested.nested1.some_field',
              value: ['val2'],
            },
          },
        ],
      },
    ],
  };
  expect(normalizeFilters(input)).toEqual(output);
});

test(`it must initialize pivots for "all" op`, () => {
  const input = {
    op: AND_OP,
    content: [
      {
        op: ALL_OP,
        content: {
          field: 'nested.nested1.some_field',
          value: ['val1', 'val2'],
        },
      },
    ],
  };
  const output = {
    op: AND_OP,
    pivot: null,
    content: [
      {
        op: AND_OP,
        pivot: 'nested.nested1',
        content: [
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'nested.nested1.some_field',
              value: ['val1'],
            },
          },
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'nested.nested1.some_field',
              value: ['val2'],
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
    op: AND_OP,
    content: [
      {
        op: AND_OP,
        content: [
          {
            op: IN_OP,
            content: {
              field: 'some_field',
              value: ['val3'],
            },
          },
          {
            op: OR_OP,
            content: [
              {
                op: IN_OP,
                content: {
                  field: 'some_field',
                  value: ['val3'],
                },
              },
              {
                op: AND_OP,
                content: [
                  {
                    op: IN_OP,
                    content: {
                      field: 'some_field',
                      value: ['val3'],
                    },
                  },
                  {
                    op: AND_OP,
                    content: [
                      {
                        op: IN_OP,
                        content: {
                          field: 'some_field',
                          value: ['val3'],
                        },
                      },
                      {
                        op: AND_OP,
                        content: [
                          {
                            op: ALL_OP,
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
    op: AND_OP,
    pivot: null,
    content: [
      {
        op: IN_OP,
        pivot: null,
        content: {
          field: 'some_field',
          value: ['val3'],
        },
      },
      {
        op: OR_OP,
        pivot: null,
        content: [
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'some_field',
              value: ['val3'],
            },
          },
          {
            op: AND_OP,
            pivot: null,
            content: [
              {
                op: IN_OP,
                pivot: null,
                content: {
                  field: 'some_field',
                  value: ['val3'],
                },
              },
              {
                op: IN_OP,
                pivot: null,
                content: {
                  field: 'some_field',
                  value: ['val3'],
                },
              },
              {
                op: AND_OP,
                pivot: null,
                content: [
                  {
                    op: IN_OP,
                    pivot: null,
                    content: {
                      field: 'some_field',
                      value: ['val3'],
                    },
                  },
                  {
                    op: IN_OP,
                    pivot: null,
                    content: {
                      field: 'some_field',
                      value: ['val3'],
                    },
                  },
                  {
                    op: IN_OP,
                    pivot: null,
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
