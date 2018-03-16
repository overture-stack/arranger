import { ARRANGER_API } from './config';
import urlJoin from 'url-join';

const api = ({ endpoint = '', body, headers }) =>
  fetch(urlJoin(ARRANGER_API, endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
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

export default api;
