export let ES_TYPES = {
  annotations: {
    index: process.env.ES_GDC_FROM_GRAPH_INDEX,
    es_type: process.env.ES_ANNOTATION_TYPE,
    name: 'Annotation',
  },
  projects: {
    index: process.env.ES_GDC_FROM_GRAPH_INDEX,
    es_type: process.env.ES_PROJECT_TYPE,
    name: 'Project',
    nested_fields: [
      'summary.data_categories',
      'summary.experimental_strategies',
    ],
    customFields: `
      disease_type: [String]
      primary_site: [String]
    `,
  },
  cases: {
    index: process.env.ES_GDC_FROM_GRAPH_INDEX,
    es_type: process.env.ES_CASE_TYPE,
    name: 'Case',
    customFields: `
      aliquot_ids: [String]
      analyte_ids: [String]
      slide_ids: [String]
      portion_ids: [String]
      sample_ids: [String]
      submitter_aliquot_ids: [String]
      submitter_analyte_ids: [String]
      submitter_sample_ids: [String]
      submitter_slide_ids: [String]
      submitter_portion_ids: [String]
      available_variation_data: [String]
      id: ID!
    `,
  },
  files: {
    index: process.env.ES_GDC_FROM_GRAPH_INDEX,
    es_type: process.env.ES_FILE_TYPE,
    name: 'File',
  },
  case_centric: {
    index: process.env.ES_CASE_CENTRIC_INDEX,
    es_type: process.env.ES_CASE_CENTRIC_TYPE,
    name: 'ECase',
  },
  gene_centric: {
    index: process.env.ES_GENE_CENTRIC_INDEX,
    es_type: process.env.ES_GENE_CENTRIC_TYPE,
    name: 'Gene',
    customFields: `
      cytoband: [String]
    `,
  },
  ssm_centric: {
    index: process.env.ES_SSM_CENTRIC_INDEX,
    es_type: process.env.ES_SSM_CENTRIC_TYPE,
    name: 'Ssm',
  },
  ssm_occurrence_centric: {
    index: process.env.ES_SSM_OCC_CENTRIC_INDEX,
    es_type: process.env.ES_SSM_OCC_CENTRIC_TYPE,
    name: 'SsmOccurrenceCentric',
  },
}

export let ROOT_TYPES = {}
