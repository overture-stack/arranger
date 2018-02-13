import { ARRANGER_API } from './config';

export default ({ endpoint = '', body, headers }) =>
  fetch(ARRANGER_API + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }).then(r => r.json());
