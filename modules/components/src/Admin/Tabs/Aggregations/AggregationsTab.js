import React from 'react';
import AggPreviews from '../../Previews/AggPreviews';
import AggsState from '../../../Aggs/AggsState';
import EditAggs from '../../../Aggs/EditAggs';

export default ({ projectId, graphqlField }) => (
  <AggsState
    projectId={projectId}
    graphqlField={graphqlField}
    render={aggsState => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <div style={{ flex: 1 }}>
          <EditAggs handleChange={aggsState.update} {...aggsState} />
        </div>
        <AggPreviews
          {...{
            setSQON: () => {},
            sqon: null,
            projectId: 'test2',
            graphqlField: 'file',
          }}
        />
      </div>
    )}
  />
);
