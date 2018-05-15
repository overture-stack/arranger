import React from 'react';

import DataTable, { ColumnsState } from '../DataTable';
import Spinner from 'react-spinkit';

const Table = ({
  onFilterChange = () => {},
  projectId,
  graphqlField,
  fetchData,
  setSQON,
  sqon,
  fieldTypesForFilter = ['text', 'keyword'],
  onTableExport = () => {},
  api,
  ...props
}) => {
  return (
    <ColumnsState
      projectId={projectId}
      graphqlField={graphqlField}
      api={api}
      render={columnState => {
        return columnState.loading ? (
          <Spinner fadeIn="full" name="circle" />
        ) : (
          <DataTable
            {...{ ...props, api }}
            projectId={projectId}
            sqon={sqon}
            config={{
              ...columnState.state,
              type: graphqlField,
            }}
            fetchData={fetchData(projectId)}
            onColumnsChange={columnState.toggle}
            onTableExport={onTableExport}
            onFilterChange={({ generateNextSQON, value }) => {
              onFilterChange(value);
              setSQON(
                generateNextSQON({
                  sqon,
                  fields: columnState.state.columns
                    .filter(
                      x =>
                        fieldTypesForFilter.includes(x.extendedType) && x.show,
                    )
                    .map(x => x.field),
                }),
              );
            }}
          />
        );
      }}
    />
  );
};

export default Table;
