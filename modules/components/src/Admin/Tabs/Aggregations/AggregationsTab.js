import React from 'react';
import DraggableListOrderer from '../../previews/DraggableListOrderer';
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
          <div>
            <strong>Aggs order</strong>
            <DraggableListOrderer
              {...{
                itemsList: aggsState.aggs.map(({ field, active, ...rest }) => ({
                  field: field,
                  active: active,
                  ...rest,
                })),
                projectId,
                graphqlField,
                onOrderChange: newItemList =>
                  aggsState.saveOrder(newItemList.map(({ field }) => field)),
              }}
            />
          </div>
        </div>
      );
    }}
  />
);
