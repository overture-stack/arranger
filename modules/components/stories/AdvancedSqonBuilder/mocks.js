export const sqons = [
  {
    op: 'and',
    content: [
      { op: 'in', content: { field: 'kf_id', value: ['GF_9V1MT6CM'] } },
    ],
  },
  {
    op: 'or',
    content: [
      {
        op: 'in',
        content: {
          field: 'participants.diagnoses.diagnosis_category',
          value: ['Cancer', 'Acute Myeloid Leukemia'],
        },
      },
      {
        op: 'in',
        content: {
          field: 'participants.phenotype.hpo_phenotype_observed_text',
          value: ['Abnormality of nervous system physiology (HP:0012638)'],
        },
      },
      {
        op: 'in',
        content: {
          field: 'participants.study.short_name',
          value: [
            'Ewing Sarcoma: Genetic Risk',
            'Pediatric Brain Tumors: CBTTC',
            'Acute Myeloid Leukemia',
          ],
        },
      },
    ],
  },
  {
    op: 'and',
    content: [
      { op: 'in', content: { field: 'kf_id', value: ['GF_9V1MT6CM'] } },
      {
        op: 'or',
        content: [
          {
            op: 'in',
            content: {
              field: 'participants.diagnoses.diagnosis_category',
              value: ['Cancer', 'Acute Myeloid Leukemia'],
            },
          },
          {
            op: 'in',
            content: {
              field: 'participants.phenotype.hpo_phenotype_observed_text',
              value: ['Abnormality of nervous system physiology (HP:0012638)'],
            },
          },
          {
            op: 'in',
            content: {
              field: 'participants.study.short_name',
              value: [
                'Ewing Sarcoma: Genetic Risk',
                'Pediatric Brain Tumors: CBTTC',
                'Acute Myeloid Leukemia',
              ],
            },
          },
          {
            op: 'and',
            content: [
              {
                op: '<=',
                content: {
                  field: 'some_numeric_field',
                  value: [2],
                },
              },
              {
                op: '>=',
                content: {
                  field: 'some_other_numeric_field',
                  value: [4],
                },
              },
              {
                op: 'between',
                content: {
                  field: 'another_numeric_field',
                  value: [3, 5],
                },
              },
            ],
          },
        ],
      },
    ],
  },
];

export const fieldDisplayMap = {
  'participants.diagnoses.diagnosis_category': 'Diagnosis Category',
  'participants.phenotype.hpo_phenotype_observed_text': 'Observed Text',
  'participants.study.short_name': 'Study Short Name',
  kf_id: 'File ID',
  some_numeric_field: 'Some Number',
  some_other_numeric_field: 'Some Other Number',
  another_numeric_field: 'Another Number',
};
