import normalizeFilters from '../../src/buildQuery/normalizeFilters';
import { IN_OP, OR_OP, AND_OP, ALL_OP } from '../../src/constants';

test(`normalizeFilters must handle falsy sqon`, () => {
  const input = null;
  const output = null;
  expect(normalizeFilters(input)).toEqual(output);
});

test(`normalizeFilters must preserve pivots`, () => {
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
