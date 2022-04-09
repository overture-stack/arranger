import { useEffect, useState } from 'react';

import columnsToGraphql from '@/utils/columnsToGraphql';

import {
  APIFetcherFn,
  ColumnStateInterface,
  ConfigsInterface,
  ExtendedMappingInterface,
  FetchDataFn,
} from './types';
import { componentConfigsQuery } from './dataQueries';

export const useConfigs = ({
  apiFetcher,
  configs: {
    columnState: customColumnState = {} as ColumnStateInterface,
    extendedMapping: customExtendedMapping = [] as ExtendedMappingInterface[],
  } = {} as ConfigsInterface,
  documentType,
}: {
  apiFetcher: APIFetcherFn;
  configs?: ConfigsInterface;
  documentType: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [columnState, setColumnState] = useState<ColumnStateInterface>(customColumnState);
  const [extendedMapping, setExtendedMapping] =
    useState<ExtendedMappingInterface[]>(customExtendedMapping);

  useEffect(() => {
    apiFetcher({
      endpoint: `/graphql/ArrangerConfigsQuery`,
      body: {
        query: componentConfigsQuery(documentType, 'ArrangerConfigs'),
      },
    })
      .then((response) => {
        const { columnsState, extended } = response?.data?.[documentType] || {};

        setColumnState(columnsState?.state);
        setExtendedMapping(extended);
      })
      .catch((error) => console.warn(error))
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiFetcher, documentType]);

  return {
    columnState,
    extendedMapping,
    isLoadingConfigs: isLoading,
  };
};

export const fetchDataInitialiser =
  ({
    apiFetcher,
    documentType,
    url,
  }: {
    apiFetcher: APIFetcherFn;
    documentType: string;
    url?: string;
  }): FetchDataFn =>
  ({ endpoint = `/graphql`, ...options } = {}) => {
    return apiFetcher({
      endpoint,
      body: columnsToGraphql({
        documentType,
        ...options,
      }),
      url,
    }).then((response) => {
      const hits = response?.data?.[documentType]?.hits || {};
      const data = (hits.edges || []).map((e: any) => e.node);
      const total = hits.total || 0;

      return { total, data };
    });
  };
