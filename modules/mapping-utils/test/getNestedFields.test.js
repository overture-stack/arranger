import getNestedFields from '../src/getNestedFields';

test('getNestedFields', () => {
  let actual = getNestedFields({
    diagnoses: {
      type: 'nested',
      properties: {
        age_at_diagnosis: {
          type: 'long',
        },
        project: {
          properties: {
            project_id: {
              type: 'keyword',
            },
          },
        },
        treatments: {
          type: 'nested',
          properties: {
            days_to_treatment: {
              type: 'long',
            },
          },
        },
      },
    },
  });

  let expected = ['diagnoses', 'diagnoses.treatments'];

  expect(actual.length).toBe(expected.length);
  expected.forEach((field, i) => expect(field).toEqual(actual[i]));
});
