import type { CustomRemoteRequestProps } from '@overture-stack/arranger-types/configs';
import axios, { type AxiosRequestConfig } from 'axios';

/**
 * GQL fetch request with request options configured for graphql
 *
 * @returns AxiosResponse
 *
 * @throws AxiosError
 */
export const fetchGql = ({
	customRequestProps,
	gqlQuery,
	options,
	url,
	variables,
}: {
	customRequestProps?: CustomRemoteRequestProps;
	url: string;
	gqlQuery: string;
	variables?: Record<string, unknown>;
	options?: { timeout: number };
}) => {
	const timeout = options?.timeout || 60000;
	const axiosOptions: AxiosRequestConfig = {
		url,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-REQUEST-TYPE': 'GraphQL',
			...(customRequestProps?.headers || {}),
		},
		data: { query: gqlQuery, variables },
		signal: AbortSignal.timeout(timeout),
	};

	return axios(axiosOptions);
};
