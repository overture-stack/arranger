import axios from 'axios';
import { print } from 'graphql';

export const createGqlQuery = ({ query: queryAST, variables }) => {
	// queries need to be strings when using regular http
	const query = print(queryAST);
	return JSON.stringify({ query, variables });
};

export const fetchGql = ({ url, gqlRequest }) => {
	const query = JSON.stringify(gqlRequest);
	const options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: query,
	};

	return axios(url, options);
};
