import { ARRANGER_API } from './config';
import urlJoin from 'url-join';
import { addDownloadHttpHeaders } from './download';

let alwaysSendHeaders = { 'Content-Type': 'application/json' };

let Token = {
  Authorization: `Bearer ${process.env.STORYBOOK_TOKEN}`,
};

const defaultApi = ({ endpoint = '', body, headers, method }) =>
  fetch(urlJoin(ARRANGER_API, endpoint), {
    method: method || 'POST',
    headers: { ...alwaysSendHeaders, ...headers, ...Token },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export const graphql = (body) => api({ endpoint: 'graphql', body });

export const fetchExtendedMapping = ({ graphqlField, projectId, api = defaultApi }) =>
  api({
    endpoint: `/${projectId}/graphql`,
    body: {
      project_code: 'indoctestproject',
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
