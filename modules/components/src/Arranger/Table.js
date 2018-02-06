import React from 'react';

import DataTable, { ColumnsState } from '../DataTable';

import { replaceFilterSQON } from '../SQONView/utils';

const Table = ({ sqon, projectId, index, streamData, fetchData, setSQON }) => {
  return (
    <ColumnsState
      projectId={projectId}
      index={index}
      render={columnState => {
        return (
          <DataTable
            sqon={sqon}
            config={columnState.state}
            setSQON={setSQON}
            onSelectionChange={console.log('selection changed')}
            streamData={streamData(index)}
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
