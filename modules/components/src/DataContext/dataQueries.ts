const columnStateFields = `columnsState {
  state {
    type
    keyField
    defaultSorted {
      id
      desc
    }
    columns {
      accessor
      canChangeShow
      field
      id
      jsonPath
      query
      show
      sortable
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
