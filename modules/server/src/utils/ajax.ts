import axios, { type AxiosRequestHeaders, type AxiosResponse } from 'axios';
import urlJoin from 'url-join';

export default (host = '', { debugAll = false, endpoint: globalEndpoint = '' }) => ({
	get: ({ endpoint = globalEndpoint, then = (response: AxiosResponse) => response }) => {
		return axios(urlJoin(host, endpoint)).then(then);
	},

	post: ({
		body,
		debug,
		endpoint = globalEndpoint,
		headers = {},
	}: {
		body: any;
		debug?: boolean;
		endpoint?: string;
		headers?: AxiosRequestHeaders;
	}) =>
		axios(urlJoin(host, endpoint), {
			data: body ? JSON.stringify(body) : undefined,
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
			method: 'POST',
		}).then((response) => {
			(debugAll || debug) && console.log('\n\n\n\nresponse:\n\n', response, '\n', response?.data, '\n\n');

			return response;
		}),
});
