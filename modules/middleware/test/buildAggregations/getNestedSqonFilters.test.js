import getNestedSqonFilters from '../../src/buildAggregations/getNestedSqonFilters';
import { AND_OP, IN_OP } from '../../src/constants';

test('getNestedSqonFilters should be able to extract filters applied on nested fields', () => {
  const sqon = {
    op: AND_OP,
    content: [
      { op: IN_OP, content: { field: 'a', value: [] } },
      { op: IN_OP, content: { field: 'a', value: [] } },
      { op: IN_OP, content: { field: 'a.c', value: [] } },
      { op: IN_OP, content: { field: 'a.b.c', value: [] } },
      { op: IN_OP, content: { field: 'a.b.d', value: [] } },
    ],
  };
  const nestedFields = ['a', 'a.b'];
  const expectedOutput = {
    a: [{ op: IN_OP, content: { field: 'a.c', value: [] } }],
    'a.b': [
      { op: IN_OP, content: { field: 'a.b.c', value: [] } },
      { op: IN_OP, content: { field: 'a.b.d', value: [] } },
    ],
  };
  expect(getNestedSqonFilters({ sqon, nestedFields })).toEqual(expectedOutput);
});

test('getNestedSqonFilters should handle nested sqons', () => {
  const sqon = {
    op: AND_OP,
    pivot: null,
    content: [
      {
        op: AND_OP,
        content: [
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'files.kf_id',
              value: ['GF_V1C32MZ6'],
            },
          },
          {
            op: IN_OP,
            pivot: null,
            content: {
              field: 'files.kf_id',
              value: ['GF_C78A0NP8'],
            },
          },
        ],
      },
    ],
  };
  const nestedFields = ['files'];
  expect(getNestedSqonFilters({ sqon, nestedFields })).toEqual({
    ['files']: [
      {
        op: IN_OP,
        pivot: null,
        content: {
          field: 'files.kf_id',
          value: ['GF_V1C32MZ6'],
        },
      },
      {
        op: IN_OP,
        pivot: null,
        content: {
          field: 'files.kf_id',
          value: ['GF_C78A0NP8'],
        },
      },
    ],
  });
});
