import { useEffect, useState } from 'react';

import { fetchExtendedMapping } from '@/utils/api';

import { APIFetcherFn, ExtendedMappingInterface } from './types';

export const useExtendedMapping = ({
  apiFetcher,
  graphqlField,
}: {
  apiFetcher: APIFetcherFn;
  graphqlField: string;
}) => {
  const [extendedMapping, setExtendedMapping] = useState<ExtendedMappingInterface[]>([]);

  useEffect(() => {
    fetchExtendedMapping({ apiFetcher, graphqlField })
      .then(({ extendedMapping }: { extendedMapping: ExtendedMappingInterface[] }) => {
        extendedMapping
          ? setExtendedMapping(extendedMapping)
          : console.error('We could not acquire Extended Mapping');
      })
      .catch((error) => console.warn(error));
  }, [apiFetcher, graphqlField]);

  return extendedMapping;
};
