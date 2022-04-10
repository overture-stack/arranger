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
      displayValues
      field
      header
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
    }
  }`;
