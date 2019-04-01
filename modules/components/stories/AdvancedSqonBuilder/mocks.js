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
          field: 'diagnoses.diagnosis_category',
          value: ['Cancer', 'Acute Myeloid Leukemia'],
        },
      },
      {
        op: 'in',
        content: {
          field: 'study.short_name',
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
              field: 'diagnoses.diagnosis_category',
              value: ['Cancer', 'Acute Myeloid Leukemia'],
            },
          },
          {
            op: 'in',
            content: {
              field: 'study.short_name',
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
              { op: '>=', content: { field: 'size', value: [123] } },
              { op: '<=', content: { field: 'size', value: [192471969710] } },
            ],
          },
          0,
        ],
      },
    ],
  },
  {
    op: 'and',
    content: [
      {
        op: 'in',
        content: {
          field: 'diagnoses.diagnosis_category',
          value: ['Cancer', 'Acute Myeloid Leukemia'],
        },
      },
      {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'study.short_name',
              value: [
                'Ewing Sarcoma: Genetic Risk',
                'Pediatric Brain Tumors: CBTTC',
                'Acute Myeloid Leukemia',
              ],
            },
          },
          {
            op: 'in',
            content: { field: 'is_proband', value: ['true'] },
          },
        ],
      },
    ],
  },
  {
    op: 'and',
    content: [
      1,
      2,
      {
        op: 'in',
        content: {
          field: 'study.short_name',
          value: [
            'Ewing Sarcoma: Genetic Risk',
            'Pediatric Brain Tumors: CBTTC',
            'Acute Myeloid Leukemia',
          ],
        },
      },
    ],
  },
];

export const fieldDisplayMap = {
  'diagnoses.diagnosis_category': 'Diagnosis Category',
  'phenotype.hpo_phenotype_observed_text': 'Observed Text',
  'study.short_name': 'Study Short Name',
  is_proband: 'Is Proband',
  kf_id: 'File ID',
  created_at: 'Created At',
  is_proband: 'Proband',
};
