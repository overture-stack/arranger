import React from 'react';

import DataTable, { ColumnsState } from '../DataTable';

const Table = ({
  projectId,
  index,
  indexName,
  fetchData,
  setSQON,
  sqon,
  ...props
}) => {
  return (
    <ColumnsState
      projectId={projectId}
      index={index}
      indexName={indexName}
      render={columnState => {
        return (
          <DataTable
            {...props}
            sqon={sqon}
            config={{
              ...columnState.state,
              type: indexName,
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
                        ['text', 'keyword'].includes(x.extendedType) && x.show,
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
