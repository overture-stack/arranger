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
 * Creates axios request instance with request options configured for graphql request
 * @returns axios instance
 */
export const fetchGql = ({ url, gqlRequest }: { url: string; gqlRequest: { query: string } }) => {
	const options = {
		url,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: gqlRequest,
	};

	return axios(options);
};
