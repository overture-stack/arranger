import React from 'react';

import DataTable, { ColumnsState } from '../DataTable';

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
          />
        );
      }}
    />
  );
};

export default Table;
