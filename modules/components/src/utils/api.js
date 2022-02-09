import axios from 'axios';
import urlJoin from 'url-join';

import { ARRANGER_API } from './config';
import { addDownloadHttpHeaders } from './download';

let alwaysSendHeaders = { 'Content-Type': 'application/json' };

const defaultApiFetcher = ({
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

export const graphql = (body) => defaultApiFetcher({ endpoint: 'graphql', body });

export const fetchExtendedMapping = ({ graphqlField, apiFetcher = defaultApiFetcher }) =>
  apiFetcher({
    endpoint: `/graphql`,
    body: {
      query: `
        {
          ${graphqlField}{
            extended
          }
        }
      `,
    },
  }).then((response) => ({
    extendedMapping: response.data[graphqlField].extended,
  }));

export const addHeaders = (headers) => {
  alwaysSendHeaders = { ...alwaysSendHeaders, ...headers };
  addDownloadHttpHeaders(headers);
};

export const getAlwaysAddHeaders = () => alwaysSendHeaders;

export default defaultApiFetcher;
