import axios, { AxiosRequestConfig } from 'axios';
import { ASTNode, print } from 'graphql';
import { GQLFieldType } from './queries';

/**
 * Creates a graphql query string with variables for use in a POST request
 * @returns string
 */
export const createGqlQuery = ({
	query: queryAST,
	variables,
}: {
	query: ASTNode;
	variables: Record<string, any>;
}) => {
	// queries need to be strings when using regular http
	const query = print(queryAST);
	return JSON.stringify({ query, variables });
};

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
	variables?: Record<string, string>;
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
