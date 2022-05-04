export const columnStateFields = `columnsState {
  state {
    keyField
    defaultSorted {
      id
      desc
    }
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
  }
}`;

export const componentConfigsQuery = (documentType: string, queryName = '') =>
  `query ${queryName} {
    ${documentType} {
      ${columnStateFields}
      extended
      mapping
    }
  }`;
