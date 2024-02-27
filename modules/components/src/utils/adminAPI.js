import { ARRANGER_ADMIN_API } from './config';
import urlJoin from 'url-join';

let alwaysSendHeaders = { 'Content-Type': 'application/json' };

let Token = {
  Authorization: `Bearer ${process.env.STORYBOOK_TOKEN}`,
};

export const defaultAdminApi = ({ endpoint = '', body, headers, method }) =>
  fetch(urlJoin(ARRANGER_ADMIN_API, endpoint), {
    method: method || 'POST',
    headers: { ...alwaysSendHeaders, ...headers, ...Token },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export default defaultAdminApi;
