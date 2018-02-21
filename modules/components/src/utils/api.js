import { ARRANGER_API } from './config';
import urlJoin from 'url-join';

export default ({ endpoint = '', body, headers }) =>
  fetch(urlJoin(ARRANGER_API, endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }).then(r => r.json());
