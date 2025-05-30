import axios, { type AxiosRequestConfig } from 'axios';

/**
 * GQL fetch request with request options configured for graphql
 *
 * @returns AxiosResponse
 *
 * @throws AxiosError
 */
export const fetchGql = ({
	url,
	gqlQuery,
	variables,
	options,
}: {
	url: string;
	gqlQuery: string;
	variables?: Record<string, unknown>;
	options?: { timeout: number };
}) => {
	const timeout = options?.timeout || 60000;
	const axiosOptions: AxiosRequestConfig = {
		url,
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-REQUEST-TYPE': 'GraphQL' },
		data: { query: gqlQuery, variables },
		signal: AbortSignal.timeout(timeout),
	};

	return axios(axiosOptions);
};
