import fetch from 'node-fetch';
import urlJoin from 'url-join';

export default host => ({ endpoint = '', body, headers = {} }) =>
  fetch(urlJoin(host, endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }).then(r => r.json());
