import axios, { AxiosRequestConfig } from 'axios';
import { GQLFieldType } from './queries';

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
		headers: { 'Content-Type': 'application/json' },
		data: { query: gqlQuery, variables },
		signal: AbortSignal.timeout(timeout),
	};

	return axios(axiosOptions);
};

export const normalizeGqlField = (gqlField: GQLFieldType): { name: string; type: string } => {
	const fieldType = gqlField.type.name;
	return { name: gqlField.name, type: fieldType };
};
