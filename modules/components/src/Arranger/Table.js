import React from 'react';

import DataTable, { ColumnsState } from '../DataTable';

const Table = ({
  projectId,
  graphqlField,
  fetchData,
  setSQON,
  sqon,
  fieldTypesForFilter = ['text', 'keyword'],
  ...props
}) => {
  return (
    <ColumnsState
      projectId={projectId}
      graphqlField={graphqlField}
      render={columnState => {
        return (
          <DataTable
            {...props}
            projectId={projectId}
            sqon={sqon}
            config={{
              ...columnState.state,
              type: graphqlField,
            }}
            fetchData={fetchData(projectId)}
            onColumnsChange={columnState.toggle}
            onFilterChange={({ generateNextSQON }) => {
              setSQON(
                generateNextSQON({
                  sqon,
                  fields: columnState.state.columns
                    .filter(
                      x =>
                        fieldTypesForFilter.includes(x.extendedType) && x.show,
                    )
                    .map(x => x.field),
                }),
              );
            }}
          />
        );
      }}
    />
  );
};

export default Table;
