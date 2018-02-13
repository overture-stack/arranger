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
            config={columnState.state}
            streamData={streamData(index, projectId)}
            fetchData={fetchData(projectId)}
            onColumnsChange={columnState.toggle}
            handleNextFilterSQON={nextFilterSQON => {
              setSQON(
                nextFilterSQON({
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
