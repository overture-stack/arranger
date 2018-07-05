import getNestedSqonFilters from '../../src/buildAggregations/getNestedSqonFilters';

test('getNestedSqonFilters should be able to extract filters applied on nested fields', () => {
  const sqon = {
    op: 'and',
    content: [
      { op: 'in', content: { field: 'a', value: [] } },
      { op: 'in', content: { field: 'a', value: [] } },
      { op: 'in', content: { field: 'a.c', value: [] } },
      { op: 'in', content: { field: 'a.b.c', value: [] } },
      { op: 'in', content: { field: 'a.b.d', value: [] } },
    ],
  };
  const nestedFields = ['a', 'a.b'];
  const expectedOutput = {
    a: [{ op: 'in', content: { field: 'a.c', value: [] } }],
    'a.b': [
      { op: 'in', content: { field: 'a.b.c', value: [] } },
      { op: 'in', content: { field: 'a.b.d', value: [] } },
    ],
  };
  expect(getNestedSqonFilters({ sqon, nestedFields })).toEqual(expectedOutput);
});

test('getNestedSqonFilters should handle sqon contents without fields', () => {
  const sqon = {
    op: 'and',
    content: [{}],
  };
  const nestedFields = [];
  expect(getNestedSqonFilters({ sqon, nestedFields })).toEqual({});
});
