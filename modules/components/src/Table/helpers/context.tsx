import { ComponentType, createContext, ReactElement, useContext, useEffect, useState } from 'react';
import { RowSelectionState } from '@tanstack/react-table';

import { useDataContext } from '@/DataContext';
import { ColumnSortingInterface } from '@/DataContext/types';
import { useThemeContext } from '@/ThemeContext';
import getComponentDisplayName from '@/utils/getComponentDisplayName';
import missingProviderHandler from '@/utils/missingProvider';
import { emptyObj } from '@/utils/noops';

import {
  ColumnsDictionary,
  TableContextInterface,
  TableContextProviderProps,
  UseTableContextProps,
} from '../types';

import { aggregateCustomColumns, columnsArrayToDictionary, getColumnsByAttribute } from './columns';

export const TableContext = createContext<TableContextInterface>({
  missingProvider: 'TableContext',
  tableData: [],
  visibleColumnsDict: {},
} as unknown as TableContextInterface);

/** Context provider for Arranger's table data and functionality
 * @param {ColumnMappingInterface[]} [columns] array with column customisations (overrides the ones from the Arranger server using 'field');
 * @param {FetchDataFn} [customFetcher] function to make customised request and subsequent data handling (e.g. middlewares);
 * @param {string} [documentType] the GraphQL field that the table should use to collect data.
 */
export const TableContextProvider = ({
  children,
  columns: customColumns,
  customFetcher,
  documentType: customDocumentType,
}: TableContextProviderProps): ReactElement<TableContextInterface> => {
  // Table content state values
  const [isFreshTable, setIsFreshTable] = useState(true);
  const [isLoadingTableData, setIsLoadingTableData] = useState(false);
  const [isStaleTableData, setIsStaleTableData] = useState(true);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedRowsDict, setSelectedRowsDict] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<ColumnSortingInterface[]>([]);
  const [tableData, setTableData] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  // the default Server + UI-provided columns
  const [allColumnsDict, setAllColumnsDict] = useState<ColumnsDictionary>({});
  const [hasShowableColumns, setHasShowableColumns] = useState(false);
  // all the columns, in their runtime state.
  const [currentColumnsDict, setCurrentColumnsDict] = useState<ColumnsDictionary>({});
  // same as above, but only the ones that are visible
  const [visibleColumnsDict, setVisibleColumnsDict] = useState<ColumnsDictionary>({});
  const [hasVisibleColumns, setHasVisibleColumns] = useState(false);

  // Pagination state values
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Arranger data context values
  const { documentType, fetchData, isLoadingConfigs, missingProvider, sqon, tableConfigs } =
    useDataContext({ callerName: 'TableContextProvider' });

  const { components: { Table: { defaultSort: themeDefaultSorting } = emptyObj } = emptyObj } =
    useThemeContext({ callerName: 'TableContextProvider' });

  useEffect(() => {
    if (tableConfigs?.columns && Object.values(allColumnsDict).length === 0) {
      const columns = aggregateCustomColumns(customColumns, tableConfigs?.columns);

      setAllColumnsDict(columnsArrayToDictionary(columns)); // these will be the default to fallback to
      setCurrentColumnsDict(columnsArrayToDictionary(columns)); // and these the ones to work with
      setHasShowableColumns(
        getColumnsByAttribute(columns, 'canChangeShow').length > 0 ||
          getColumnsByAttribute(columns, 'show').length > 0,
      );
      setSorting(
        (Array.isArray(themeDefaultSorting) &&
          themeDefaultSorting.length > 0 &&
          themeDefaultSorting) ||
          tableConfigs?.defaultSorting ||
          [],
      );
    }
  }, [tableConfigs, customColumns, isLoadingConfigs, themeDefaultSorting]);

  useEffect(() => {
    const visibleColumns = getColumnsByAttribute(Object.values(currentColumnsDict), 'show');
    setVisibleColumnsDict(columnsArrayToDictionary(visibleColumns));
    setHasVisibleColumns(visibleColumns.length > 0);
  }, [currentColumnsDict]);

  useEffect(() => {
    setSelectedRows(
      Object.entries(selectedRowsDict).reduce(
        (acc: string[], [fieldName, selected]) => (selected ? acc.concat(fieldName) : acc),
        [],
      ),
    );
  }, [selectedRowsDict]);

  useEffect(() => {
    setIsStaleTableData(true);
    setTableData([]);
  }, [currentColumnsDict, sqon]);

  useEffect(() => {
    if (
      !isLoadingConfigs && // there's configs
      !isLoadingTableData && // data is not already being fetched
      hasVisibleColumns && // there are visible columns to query
      isStaleTableData // any data available needs to be updated
    ) {
      setIsLoadingTableData(true);
      fetchData({
        config: {
          columns: Object.values(visibleColumnsDict),
          documentType,
        },
        endpoint: '/graphql/TableDataQuery',
        queryName: 'tableData',
        sort: sorting.map(({ field, desc }) => ({
          field,
          order: desc ? 'desc' : 'asc',
        })),
      })
        .then(({ total = 0, data } = emptyObj) => {
          isFreshTable && setIsFreshTable(false);
          setIsStaleTableData(false);
          setTableData(data);
          setTotal(total);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => setIsLoadingTableData(false));
    }
  }, [
    documentType,
    fetchData,
    hasVisibleColumns,
    isFreshTable,
    isLoadingConfigs,
    isLoadingTableData,
    isStaleTableData,
    sorting,
    visibleColumnsDict,
  ]);

  const contextValues = {
    allColumnsDict,
    currentColumnsDict,
    currentPage,
    defaultSorting: themeDefaultSorting,
    documentType,
    fetchData: customFetcher || fetchData,
    hasSelectedRows: selectedRows.length > 0,
    hasShowableColumns,
    hasVisibleColumns,
    isFreshTable,
    isLoading:
      isLoadingConfigs ||
      isFreshTable ||
      isLoadingTableData ||
      (hasVisibleColumns && isStaleTableData),
    keyField: tableConfigs?.keyField,
    missingProvider:
      // ideally allows for passing in sufficient props to cover the absence of a data context.
      !(customColumns && customDocumentType && customFetcher) && missingProvider,
    pageSize,
    selectedRows,
    selectedRowsDict,
    setCurrentPage,
    setPageSize,
    setCurrentColumnsDict,
    setSelectedRowsDict,
    sqon,
    tableData,
    total,
    visibleColumnsDict,
  };

  return <TableContext.Provider value={contextValues}>{children}</TableContext.Provider>;
};

/** hook for table data access and aggregation
 * @param {string} [callerName] (optional) usually your component name. used to assist troubleshooting context issues.
 * @param {FetchDataFn} [customFetcher] (optional) takes a custom data fetching function to override requests locally.
 * @returns {TableContextInterface} data object
 */
export const useTableContext = ({
  callerName,
  customFetcher: localFetcher,
}: UseTableContextProps = emptyObj): TableContextInterface => {
  const defaultContext = useContext(TableContext);

  defaultContext.missingProvider && missingProviderHandler(TableContext.displayName, callerName);

  return {
    ...defaultContext,
    fetchData: localFetcher || defaultContext.fetchData,
  };
};

/** HOC for table data access
 * @param {ComponentType} Component the component you want to provide Arranger table data to.
 * @returns {DataContextInterface} data object
 */
export const withTableContext = <Props extends object>(Component: ComponentType<Props>) => {
  const callerName = getComponentDisplayName(Component);
  const ComponentWithData = (props: Props) => {
    const dataProps = {
      ...props,
      ...useTableContext({ callerName }),
    };

    return <Component {...dataProps} />;
  };

  ComponentWithData.displayName = `WithArrangerTableContext(${callerName})`;

  return ComponentWithData;
};

if (process.env.NODE_ENV === 'development') {
  TableContext.displayName = 'ArrangerTableContext';
  TableContextProvider.displayName = 'ArrangerTableContextProvider';
}
