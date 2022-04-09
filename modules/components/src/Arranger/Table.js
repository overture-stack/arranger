import Spinner from 'react-spinkit';

import DataTable, { ColumnsState } from '@/DataTable';
import TextInput from '@/Input';
import defaultApiFetcher from '@/utils/api';
import noopFn from '@/utils/noopFns';

const Table = ({
  onFilterChange = noopFn,
  documentType = '',
  fetchData = defaultApiFetcher,
  setSQON,
  sqon,
  fieldTypesForFilter = ['text', 'keyword'],
  apiFetcher,
  InputComponent = TextInput,
  showFilterInput = true,
  customHeaderContent = null,
  sessionStorage = false, // Use session storage to save selected columns, page size, and column sort.
  storageKey = '', // Identifier to use in session storage property name where state info is stored. Use the same save-key in multiple tables to share save state.
  ...props
}) => {
  return (
    <ColumnsState
      documentType={documentType}
      apiFetcher={apiFetcher}
      sessionStorage={sessionStorage}
      storageKey={storageKey}
      render={(columnState) => {
        return columnState.loading ? (
          <Spinner fadeIn="full" name="circle" />
        ) : (
          <DataTable
            {...{ ...props, apiFetcher, showFilterInput, customHeaderContent }}
            InputComponent={InputComponent}
            sqon={sqon}
            config={{
              ...columnState.state,
              // generates a handy dictionary with all the available columns
              allColumns: columnState.state.columns.reduce(
                (columnsDict, column) => ({
                  ...columnsDict,
                  [column.field]: column,
                }),
                {},
              ),
              documentType,
            }}
            fetchData={fetchData}
            onColumnsChange={columnState.toggle}
            onMultipleColumnsChange={columnState.toggleMultiple}
            onFilterChange={({ generateNextSQON, value }) => {
              onFilterChange(value);
              setSQON(
                generateNextSQON({
                  sqon,
                  fields: columnState.state.columns
                    .filter((x) => fieldTypesForFilter.includes(x.extendedType) && x.show)
                    .map((x) => x.field),
                }),
              );
            }}
            sessionStorage={sessionStorage}
            storageKey={storageKey}
          />
        );
      }}
    />
  );
};

export default Table;
