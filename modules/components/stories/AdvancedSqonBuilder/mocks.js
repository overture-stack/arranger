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
          value: ['Cancer'],
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
          ],
        },
      },
    ],
  },
];
