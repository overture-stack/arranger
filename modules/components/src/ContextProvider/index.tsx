import React, { createContext, useContext, useState } from 'react';

import defaultApiFetcher from '@/utils/api';
import columnsToGraphql from '@/utils/columnsToGraphql';
import { arrangerTheme, ThemeProvider } from '@/ThemeProvider';

import {
  DataContextInterface,
  FetchDataFn,
  SQONType,
  DataProviderProps,
  UseDataContextProps,
} from './types';

export const DataContext = createContext<DataContextInterface>({} as DataContextInterface);
// returning "as interface" so the type is explicit while integrating into another app
if (process.env.NODE_ENV === 'development') {
  DataContext.displayName = 'ArrangerDataContext';
}

export const DataProvider = ({
  children,
  customFetcher: apiFetcher = defaultApiFetcher,
  theme = arrangerTheme.default,
  url = '',
}: DataProviderProps): React.ReactElement<DataContextInterface> => {
  const [sqon, setSQON] = useState<SQONType>(null);
  // TODO: should this SQON override the one in fetcher `options`?

  const fetchData: FetchDataFn = (options = {}) =>
    apiFetcher({
      endpoint: `/graphql`,
      body: columnsToGraphql(options),
      url,
    }).then((response) => {
      const hits = options?.config?.type ? response?.data?.[options.config.type]?.hits : {};
      const data = (hits.edges || []).map((e: any) => e.node);
      const total = hits.total || 0;
      return { total, data };
    });

  const contextValues = {
    fetchData,
    sqon,
    setSQON,
  };

  return (
    <DataContext.Provider value={contextValues}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </DataContext.Provider>
  );
};

export const useDataContext = ({
  customFetcher: localFetcher,
}: UseDataContextProps = {}): DataContextInterface => {
  const defaultContext = useContext(DataContext);

  return {
    ...defaultContext,
    fetchData: localFetcher || defaultContext.fetchData,
  };
};
