import { useCallback, useEffect, useState } from 'react';

import columnsToGraphql from '@/utils/columnsToGraphql';
import { emptyObj } from '@/utils/noops';

import {
  APIFetcherFn,
  ColumnsStateInterface,
  ConfigsInterface,
  ExtendedMappingInterface,
  FetchDataFn,
  SQONType,
} from './types';
import { componentConfigsQuery } from './dataQueries';

export const useConfigs = ({
  apiFetcher,
  configs: {
    columnsState: customColumnsState = emptyObj as ColumnsStateInterface,
    extendedMapping: customExtendedMapping = [] as ExtendedMappingInterface[],
  } = emptyObj as ConfigsInterface,
  documentType,
}: {
  apiFetcher: APIFetcherFn;
  configs?: ConfigsInterface;
  documentType: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [columnsState, setColumnsState] = useState<ColumnsStateInterface>(customColumnsState);
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

        setColumnsState(columnsState?.state);
        setExtendedMapping(extended);
      })
      .catch((error) => console.warn(error))
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiFetcher, documentType]);

  return {
    columnsState,
    extendedMapping,
    isLoadingConfigs: isLoading,
  };
};

export const useDataFetcher = ({
  apiFetcher,
  documentType,
  sqon,
  url,
}: {
  apiFetcher: APIFetcherFn;
  documentType: string;
  sqon?: SQONType;
  url?: string;
}): FetchDataFn =>
  useCallback<FetchDataFn>(
    ({ endpoint = `/graphql`, ...options } = emptyObj) =>
      apiFetcher({
        endpoint,
        body: columnsToGraphql({
          documentType,
          sqon,
          ...options,
        }),
        url,
      }).then((response) => {
        const hits = response?.data?.[documentType]?.hits || {};
        const data = (hits.edges || []).map((e: any) => e.node);
        const total = hits.total || 0;

        return { total, data };
      }),
    [apiFetcher, documentType, sqon, url],
  );
