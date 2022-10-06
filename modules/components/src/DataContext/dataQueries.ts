export const downloadsConfigs = `
  downloads {
    allowCustomMaxRows
    maxRows
  }
`;

export const facetsConfigs = `
  facets {
    aggregations {
      fieldName
      show
      active
    }
  }
`;

export const tableConfigs = `
  table {
    columns {
      accessor
      canChangeShow
      displayFormat
      displayName
      displayValues
      fieldName
      id
      isArray
      jsonPath
      query
      show
      sortable
      type
    }
    defaultSorting {
      desc
      fieldName
    }
    keyFieldName
  }
`;

export const componentConfigsQuery = (documentType: string, queryName = '') =>
  `query ${queryName} {
    ${documentType} {
      configs{
        ${downloadsConfigs}
        extended
        ${facetsConfigs}
        ${tableConfigs}
      }
      mapping
    }
  }`;
