import { ARRANGER_API } from './config';
import urlJoin from 'url-join';

let alwaysSendHeaders = { 'Content-Type': 'application/json' };
const api = ({ endpoint = '', body, headers }) =>
  fetch(urlJoin(ARRANGER_API, endpoint), {
    method: 'POST',
    headers: { ...alwaysSendHeaders, ...headers },
    body: JSON.stringify(body),
  }).then(r => r.json());

export const fetchExtendedMapping = ({ graphqlField, projectId }) =>
  api({
    endpoint: `/${projectId}/graphql`,
    body: {
      query: `
        {
          ${graphqlField}{
            extended
          }
        }
      `,
    },
  }).then(response => ({
    extendedMapping: response.data[graphqlField].extended,
  }));

export const addHeaders = headers => {
  alwaysSendHeaders = { ...alwaysSendHeaders, ...headers };
};

export default api;
