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
            onFilterChange={value =>
              setSQON(
                replaceFilterSQON(
                  {
                    op: 'and',
                    content: [
                      {
                        op: 'filter',
                        content: {
                          fields: columnState.state.columns
                            .filter(
                              x =>
                                ['text', 'keyword'].includes(x.extendedType) &&
                                x.show,
                            )
                            .map(x => x.field),
                          value,
                        },
                      },
                    ],
                  },
                  sqon,
                ),
              )
            }
          />
        );
      }}
    />
  );
};

export default Table;
