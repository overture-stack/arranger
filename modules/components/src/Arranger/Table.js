import React from 'react';

import DataTable, { ColumnsState } from '../DataTable';

import { replaceFilterSQON } from '../SQONView/utils';

const Table = ({
  projectId,
  index,
  streamData,
  fetchData,
  setSQON,
  sqon,
  ...props
}) => {
  return (
    <ColumnsState
      projectId={projectId}
      index={index}
      render={columnState => {
        return (
          <DataTable
            {...props}
            sqon={sqon}
            config={columnState.state}
            streamData={streamData(index, projectId)}
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
