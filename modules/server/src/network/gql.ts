import axios from 'axios';
import { ASTNode, print } from 'graphql';

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
}: {
	url: string;
	gqlQuery: string;
	variables?: Record<string, string>;
}) => {
	const options = {
		url,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: { query: gqlQuery, variables },
	};

	return axios(options);
};
