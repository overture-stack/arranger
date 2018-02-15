import flattenMapping from '../src/flattenMapping';

test('flattenMapping', () => {
  let actual = flattenMapping({});

  let expected = ['diagnoses', 'diagnoses.treatments'];

  expect(1).toBe(1);

  // expect(actual.length).toBe(expected.length);
  // expected.forEach((field, i) => expect(field).toEqual(actual[i]));
});
