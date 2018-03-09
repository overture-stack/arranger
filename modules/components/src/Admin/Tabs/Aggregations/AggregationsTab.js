import React from 'react';
import AggPreviews from '../../previews/AggPreviews';
import AggsState from '../../../Aggs/AggsState';
import EditAggs from '../../../Aggs/EditAggs';

export default ({ projectId, graphqlField }) => (
  <AggsState
    projectId={projectId}
    graphqlField={graphqlField}
    render={aggsState => {
      return (
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
              aggsState,
              projectId,
              graphqlField,
            }}
          />
        </div>
      );
    }}
  />
);
