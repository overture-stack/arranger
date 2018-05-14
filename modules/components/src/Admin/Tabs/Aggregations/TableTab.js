import React from 'react';
import DraggableListOrderer from '../DraggableListOrderer';
import { ColumnsState, EditColumns } from '../../../DataTable';

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
        {!columnsState.loading && (
          <>
            <div style={{ flex: 1 }}>
              <EditColumns
                handleChange={columnsState.update}
                addColumn={columnsState.add}
                {...columnsState}
              />
            </div>
            <div>
              <strong>Columns order</strong>
              <DraggableListOrderer
                {...{
                  itemsList: columnsState.state?.columns?.map(
                    ({ show, ...rest }) => ({
                      active: show,
                      ...rest,
                    }),
                  ),
                  projectId,
                  graphqlField,
                  onOrderChange: newItemList =>
                    columnsState.saveOrder(
                      newItemList.map(({ field }) => field),
                    ),
                }}
              />
            </div>
          </>
        )}
      </div>
    )}
  />
);
