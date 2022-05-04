import { ComponentType, createContext, ReactElement, useContext, useEffect, useState } from 'react';

import { useDataContext } from '@/DataContext';
import getComponentDisplayName from '@/utils/getComponentDisplayName';
import missingProviderHandler from '@/utils/missingProvider';
import { emptyObj } from '@/utils/noops';

import {
  ColumnsDictionary,
  TableContextInterface,
  TableContextProviderProps,
  UseTableContextProps,
} from '../types';

import { aggregateCustomColumns, getVisibleColumns } from './columns';

export const TableContext = createContext<TableContextInterface>({
  providerMissing: true,
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
  const { columnsState, documentType, fetchData, isLoadingConfigs, providerMissing, sqon } =
    useDataContext({ callerName: 'TableContextProvider' });

  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingTableData, setIsLoadingTableData] = useState(false);
  const [isStaleTableData, setIsStaleTableData] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [selectedTableRows, setSelectedTableRows] = useState<string[]>([]);
  const [tableData, setTableData] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [visibleColumnsDict, setVisibleColumnsDict] = useState<ColumnsDictionary>({});

  useEffect(() => {
    isLoadingConfigs ||
      setVisibleColumnsDict(
        getVisibleColumns(aggregateCustomColumns(customColumns, columnsState?.columns)),
      );
  }, [columnsState, customColumns, isLoadingConfigs]);

  useEffect(() => {
    setIsStaleTableData(true);
  }, [sqon]);

  useEffect(() => {
    !isLoadingConfigs && // there's configs
      !isLoadingTableData && // data is not already being fetched
      Object.keys(visibleColumnsDict).length > 0 && // there are visible columns to query
      isStaleTableData && // any data available needs to be updated
      (setIsLoadingTableData(true),
      fetchData({
        config: {
          columns: Object.values(visibleColumnsDict),
          documentType,
        },
        endpoint: '/graphql/TableDataQuery',
        queryName: 'tableData',
      })
        .then(({ total = 0, data } = emptyObj) => {
          setTotal(total);
          setTableData(data);
          setIsStaleTableData(false);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => setIsLoadingTableData(false)));
  }, [
    documentType,
    fetchData,
    isLoadingConfigs,
    isLoadingTableData,
    isStaleTableData,
    visibleColumnsDict,
  ]);

  const contextValues = {
    currentPage,
    documentType,
    fetchData: customFetcher || fetchData,
    isLoading: isLoadingConfigs || isLoadingTableData || isStaleTableData,
    pageSize,
    providerMissing: providerMissing && !(customColumns && customDocumentType && customFetcher),
    selectedTableRows,
    setCurrentPage,
    setPageSize,
    setSelectedTableRows,
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

  defaultContext.providerMissing && missingProviderHandler(TableContext.displayName, callerName);

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
