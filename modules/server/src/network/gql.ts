import { getIntrospectionQuery, print } from 'graphql';
import gql from 'graphql-tag';

// export const introspectionQueryGql = gql`
// 	query ($name: String!) {
// 		__type(name: $name) {
// 			name
// 			fields {
// 				name
// 				type {
// 					name
// 				}
// 			}
// 		}
// 	}
// `;
export const introspectionQueryGql = getIntrospectionQuery();

//export const fullDocumentQueryGql = gql``;

// TS THIS?
export const createGqlQuery = ({ query: queryAST, variables }) => {
	// queries need to be strings when using regular http
	const query = print(queryAST);
	return JSON.stringify({ query, variables });
};

export const createIntrospectionQuery = (documentType: string) => {
	const queryAST = introspectionQueryGql;
	// queries need to be strings when using regular http
	const query = print(queryAST);
	const variables = { name: documentType };
	return JSON.stringify({ query, variables });
};

type GqlRequest = { query: any; variables: any }; // TOOD: native type?
export const fetchGql = ({ url, gqlRequest }) => {
	const query = JSON.stringify(gqlRequest);
	const options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: query,
	};

	return fetch(url, options);
};

export { getIntrospectionQuery } from 'graphql';
