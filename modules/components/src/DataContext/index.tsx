import { ComponentType, createContext, ReactElement, useContext, useState } from 'react';

import { ThemeProvider } from '@/ThemeContext';
import defaultApiFetcher from '@/utils/api';
import getComponentDisplayName from '@/utils/getComponentDisplayName';
import missingProviderHandler from '@/utils/missingProvider';

import { fetchDataInitialiser, useConfigs } from './helpers';
import { DataContextInterface, DataProviderProps, SQONType, UseDataContextProps } from './types';

export const DataContext = createContext<DataContextInterface>({
  documentType: '',
  providerMissing: true,
} as DataContextInterface);

/** Context provider for Arranger's data and functionality
 * @param {APIFetcherFn} [customFetcher=apiFetcher] function to make customised request and subsequent data handling (e.g. middlewares).
 * @param {string} [documentType] the GraphQL field that Arranger should use to collect the data for this provider.
 * @param {object} [legacyProps] allows passing items currently managed by `<Arranger />`, to ease migration. For maintainer use only.
 * **Highly discouraged props, as it will be deprecated in an upcoming version.**
 * @param {Theme} [theme] allows giving the provider a custom version of the theme for the consumers.
 * @param {string} [url] customises where requests should be made by the data fetcher.
 */
export const DataProvider = ({
  children,
  customFetcher: apiFetcher = defaultApiFetcher,
  documentType,
  legacyProps,
  theme,
  url,
}: DataProviderProps): ReactElement<DataContextInterface> => {
  const [sqon, setSQON] = useState<SQONType>(null);

  const { columnsState, extendedMapping, isLoadingConfigs } = useConfigs({
    apiFetcher,
    documentType,
  });

  const fetchData = fetchDataInitialiser({ apiFetcher, documentType, url });

  const contextValues = {
    columnsState,
    extendedMapping,
    fetchData,
    documentType,
    isLoadingConfigs,
    setSQON,
    sqon,
  };

  return (
    <DataContext.Provider value={contextValues}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </DataContext.Provider>
  );
};

/** hook for data access and aggregation
 * @param {string} [callerName] (optional) usually your component name. used to assist troubleshooting context issues.
 * @param {FetchDataFn} [customFetcher] (optional) takes a custom data fetching function to override requests locally.
 * @returns {DataContextInterface} data object
 */
export const useDataContext = ({
  callerName,
  customFetcher: localFetcher,
}: UseDataContextProps = {}): DataContextInterface => {
  const defaultContext = useContext(DataContext);

  defaultContext.providerMissing && missingProviderHandler(DataContext.displayName, callerName);

  return {
    ...defaultContext,
    fetchData: localFetcher || defaultContext?.fetchData,
  };
};

/** HOC for data access
 * @param {ComponentType} Component the component you want to provide Arranger data to.
 * @returns {DataContextInterface} data object
 */
export const withData = <Props extends object>(Component: ComponentType<Props>) => {
  const callerName = getComponentDisplayName(Component);
  const ComponentWithData = (props: Props) => {
    const dataProps = {
      ...props,
      ...useDataContext({ callerName }),
    };

    return <Component {...dataProps} />;
  };

  ComponentWithData.displayName = `WithArrangerData(${callerName})`;

  return ComponentWithData;
};

if (process.env.NODE_ENV === 'development') {
  DataContext.displayName = 'ArrangerDataContext';
  DataProvider.displayName = 'ArrangerDataProvider';
}
