export const downloadsConfigs = `
  downloads {
    allowCustomMaxRows
    maxRows
  }
`;

export const facetsConfigs = `
  facets {
    aggregations {
      field
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
      field
      id
      isArray
      jsonPath
      query
      show
      sortable
      type
    }
    keyField
    defaultSorting {
      desc
      field
    }
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
