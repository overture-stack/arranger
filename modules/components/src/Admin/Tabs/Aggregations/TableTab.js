import React from 'react';
import DraggableListOrderer from '../../previews/DraggableListOrderer';
import ColumnsState from '../../../DataTable/ColumnsState';
import EditColumns from '../../../DataTable/EditColumns';

export default ({ projectId, graphqlField }) => (
  <ColumnsState
    projectId={projectId}
    graphqlField={graphqlField}
    render={columnsState => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <div style={{ flex: 1 }}>
          <EditColumns handleChange={columnsState.update} {...columnsState} />
        </div>
        <div>
          <strong>Columns order</strong>
          <DraggableListOrderer
            {...{
              itemsList: columnsState.state.columns.map(
                ({ field, ...rest }) => ({
                  field: field.split('.').join('__'),
                  active: rest.show,
                  ...rest,
                }),
              ),
              projectId,
              graphqlField,
              onOrderChange: newItemList =>
                columnsState.saveOrder(
                  newItemList.map(({ field }) => field.split('__').join('.')),
                ),
            }}
          />
        </div>
      </div>
    )}
  />
);
