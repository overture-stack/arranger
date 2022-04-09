import axios from 'axios';
import urlJoin from 'url-join';

import { APIFetcherFn } from '@/DataContext/types';

import { ARRANGER_API } from './config';
import { addDownloadHttpHeaders } from './download';

let alwaysSendHeaders = { 'Content-Type': 'application/json' };

const defaultApiFetcher: APIFetcherFn = ({
  endpoint = '',
  body,
  headers = {},
  method = 'POST',
  url = ARRANGER_API,
}) =>
  axios(urlJoin(url, endpoint), {
    data: JSON.stringify(body),
    headers: { ...alwaysSendHeaders, ...headers },
    method,
  });

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
