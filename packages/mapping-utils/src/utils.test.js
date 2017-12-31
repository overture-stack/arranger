import {
  mappingToScalarFields,
  mappingToNestedTypes,
  mappingToAggsType,
  getNestedFields,
} from '~/utils'

test('mappingToScalarFields', () => {
  mappingToScalarFields({
    case_id: {
      type: 'keyword',
    },
  }).forEach(field => expect(field).toBe('case_id: String'))
})

test('mappingToNestedTypes', () => {
  let actual = mappingToNestedTypes('ECase', {
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
  })

  let expected = [
    `
    typeECaseDiagnosesProject {
      project_id: String
    }
    type ECaseDiagnosesTreatments {
      days_to_treatment: Float
    }
    type ECaseDiagnoses {
      age_at_diagnosis: Float
      project: ECaseDiagnosesProject
      treatments: [ECaseDiagnosesTreatments]
    }
  `,
  ]

  actual.every((type, i) =>
    expect(type.replace(/\s/g, '')).toBe(expected[i].replace(/\s/g, '')),
  )
})

test('mappingToAggsType', () => {
  let actual = mappingToAggsType({
    diagnoses: {
      type: 'nested',
      properties: {
        age_at_diagnosis: {
          type: 'long',
        },
        treatments: {
          type: 'nested',
          properties: {
            state: {
              type: 'keyword',
            },
          },
        },
      },
    },
  })

  let expected = [
    'diagnoses__age_at_diagnosis: NumericAggregations',
    'diagnoses__treatments__state: Aggregations',
  ]

  expect(actual.length).toBe(expected.length)
  actual.forEach((x, i) => expect(x).toBe(expected[i]))
})

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
  })

  let expected = ['diagnoses', 'diagnoses.treatments']

  expect(actual.length).toBe(expected.length)
})
