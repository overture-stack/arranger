import React from 'react';
import { compose } from 'recompose';
import { injectState } from 'freactal';

import DataTable, { ColumnsState } from '../DataTable';

const enhance = compose(injectState);

const Table = ({
  state: { arranger: { sqon, projectId, index, streamData, fetchData } },
  effects: { setSQON },
}) => {
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
            streamData={streamData}
            fetchData={fetchData}
          />
        );
      }}
    />
  );
};

export default enhance(Table);
