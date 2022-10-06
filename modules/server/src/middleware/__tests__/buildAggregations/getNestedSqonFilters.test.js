import getNestedSqonFilters from '../../buildAggregations/getNestedSqonFilters';
import { AND_OP, IN_OP } from '../../constants';

test('getNestedSqonFilters should be able to extract filters applied on nested fields', () => {
  const sqon = {
    op: AND_OP,
    content: [
      { op: IN_OP, content: { fieldName: 'a', value: [] } },
      { op: IN_OP, content: { fieldName: 'a', value: [] } },
      { op: IN_OP, content: { fieldName: 'a.c', value: [] } },
      { op: IN_OP, content: { fieldName: 'a.b.c', value: [] } },
      { op: IN_OP, content: { fieldName: 'a.b.d', value: [] } },
    ],
  };
  const nestedFieldNames = ['a', 'a.b'];
  const expectedOutput = {
    a: [{ op: IN_OP, pivot: null, content: { fieldName: 'a.c', value: [] } }],
    'a.b': [
      { op: IN_OP, pivot: null, content: { fieldName: 'a.b.c', value: [] } },
      { op: IN_OP, pivot: null, content: { fieldName: 'a.b.d', value: [] } },
    ],
  };
  expect(getNestedSqonFilters({ sqon, nestedFieldNames })).toEqual(expectedOutput);
});

test('getNestedSqonFilters should handle faulsey sqon', () => {
  const sqon = null;
  const nestedFieldNames = [];
  expect(getNestedSqonFilters({ sqon, nestedFieldNames })).toEqual({});
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
              fieldName: 'files.kf_id',
              value: ['GF_V1C32MZ6'],
            },
          },
          {
            op: IN_OP,
            pivot: null,
            content: {
              fieldName: 'files.kf_id',
              value: ['GF_C78A0NP8'],
            },
          },
        ],
      },
    ],
  };
  const nestedFieldNames = ['files'];
  expect(getNestedSqonFilters({ sqon, nestedFieldNames })).toEqual({
    files: [
      {
        op: IN_OP,
        pivot: null,
        content: {
          fieldName: 'files.kf_id',
          value: ['GF_V1C32MZ6'],
        },
      },
      {
        op: IN_OP,
        pivot: null,
        content: {
          fieldName: 'files.kf_id',
          value: ['GF_C78A0NP8'],
        },
      },
    ],
  });
});

test('getNestedSqonFilters should ignore fields pivotted operations', () => {
  const sqon = {
    op: AND_OP,
    pivot: null,
    content: [
      {
        op: AND_OP,
        pivot: 'files',
        content: [
          {
            op: IN_OP,
            pivot: null,
            content: { fieldName: 'files.kf_id', value: ['GF_V1C32MZ6'] },
          },
          {
            op: IN_OP,
            pivot: null,
            content: { fieldName: 'files.kf_id', value: ['GF_C78A0NP8'] },
          },
        ],
      },
    ],
  };
  const nestedFieldNames = ['files'];
  const output = getNestedSqonFilters({ sqon, nestedFieldNames });
  expect(output).toEqual({});
});
