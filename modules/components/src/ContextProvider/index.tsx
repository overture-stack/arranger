import React, { createContext, ReactNode, useContext, useState } from 'react';

import defaultApiFetcher from '@/utils/api';
import columnsToGraphql from '@/utils/columnsToGraphql';

import {
  APIFetcherFn,
  ContextInterface,
  FetchDataFn,
  SQONType,
  UseArrangerContextFn,
} from './types';

export const ArrangerContext = createContext<ContextInterface>({} as unknown as ContextInterface);
// returning "as interface" so the type is explicit while integrating into another app

export const ArrangerProvider = ({
  children,
  customFetcher: apiFetcher = defaultApiFetcher,
  url = '',
}: {
  children: ReactNode;
  customFetcher?: APIFetcherFn;
  url?: string;
}) => {
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

  return <ArrangerContext.Provider value={contextValues}>{children}</ArrangerContext.Provider>;
};

const useArrangerContext: UseArrangerContextFn = ({ customFetcher: localFetcher } = {}) => {
  const defaultContext = useContext(ArrangerContext);

  return {
    ...defaultContext,
    fetchData: localFetcher || defaultContext.fetchData,
  };
};

export default useArrangerContext;
