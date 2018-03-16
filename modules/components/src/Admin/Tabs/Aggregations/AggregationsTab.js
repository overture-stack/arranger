import React from 'react';
import DraggableListOrderer from '../DraggableListOrderer';
import { EditAggs, AggsState } from '../../../Aggs';

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
            <strong>Aggregation Order</strong>
            <DraggableListOrderer
              {...{
                itemsList: aggsState.aggs.map(({ field, ...rest }) => ({
                  field: field.split('__').join('.'),
                  ...rest,
                })),
                projectId,
                graphqlField,
                onOrderChange: newItemList =>
                  aggsState.saveOrder(
                    newItemList.map(({ field }) => field.split('.').join('__')),
                  ),
              }}
            />
          </div>
        </div>
      );
    }}
  />
);
