import { ARRANGER_API } from './config';
import urlJoin from 'url-join';
import { addDownloadHttpHeaders } from './download';

let alwaysSendHeaders = { 'Content-Type': 'application/json' };

const defaultApi = ({ endpoint = '', body, headers, method = 'POST' }) =>
  fetch(urlJoin(ARRANGER_API, endpoint), {
    body: JSON.stringify(body),
    headers: { ...alwaysSendHeaders, ...headers },
    method,
  }).then((r) => r.json());

export const graphql = (body) => defaultApi({ endpoint: 'graphql', body });

export const fetchExtendedMapping = ({ graphqlField, api = defaultApi }) =>
  api({
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

export default defaultApi;
