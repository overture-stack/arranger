import axios from 'axios';
import urlJoin from 'url-join';

import { APIFetcherFn } from '@/DataContext/types';

import { ARRANGER_API } from './config';
import { addDownloadHttpHeaders } from './download';
import { emptyObj } from './noops';

let alwaysSendHeaders = { 'Content-Type': 'application/json' };

// TODO: create a different cache per context/caller;
const cache = new Map();

const defaultApiFetcher: APIFetcherFn = async (args) => {
  const key = JSON.stringify(args);

  if (cache.has(key)) return cache.get(key);

  const { endpoint = '', body, headers = emptyObj, method = 'POST', url = ARRANGER_API } = args;

  const response = await axios(urlJoin(url, endpoint), {
    data: JSON.stringify(body),
    headers: { ...alwaysSendHeaders, ...headers },
    method,
  });

  cache.set(key, response);

  return response;
};

export const graphql = (body: unknown) => defaultApiFetcher({ endpoint: 'graphql', body });

export const fetchExtendedMapping = ({
  documentType,
  apiFetcher = defaultApiFetcher,
}: {
  documentType: string;
  apiFetcher: APIFetcherFn;
}) =>
  apiFetcher({
    endpoint: `/graphql/extendedMapping`,
    body: {
      query: `query extendedMapping
        {
          ${documentType}{
            extended
          }
        }
      `,
    },
  }).then((response) => ({
    extendedMapping: response.data[documentType].extended,
  }));

export const addHeaders = (headers: Headers) => {
  alwaysSendHeaders = { ...alwaysSendHeaders, ...headers };
  addDownloadHttpHeaders(headers);
};

export const getAlwaysAddHeaders = () => alwaysSendHeaders;

export default defaultApiFetcher;
