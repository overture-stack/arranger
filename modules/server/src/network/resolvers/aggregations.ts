import { gql } from 'apollo-server-core';
import { DocumentNode } from 'graphql';
import { fetchGql } from '../gql';
import { GQLResponse, supportedAggregationQueries } from '../queries';
import { NetworkAggregationConfig } from '../types';
import { ASTtoString, fulfilledPromiseFilter } from '../util';

/**
 * Query remote connections and handle network responses
 *
 * @param query
 * @returns
 */
const queryConnection = async (query: NetworkQuery) => {
	const { url, gqlQuery } = query;
	try {
		const response = await fetchGql({
			url,
			gqlQuery: ASTtoString(gqlQuery),
		});

		// axios response "data" field, graphql response "data" field
		const responseData = response.data?.data;
		if (response.status === 200 && response.statusText === 'OK') {
			return responseData;
		}

		console.error('unexpected response data');
	} catch (error) {
		/*
		 * TODO: expand on error handling for instance of Axios error for example
		 */
		console.error(`network failure!`);
		console.log(error.response.data);
		console.log(error.response.status);
		console.log(error.response.headers);
		console.log(error.toJSON());

		return;
	}
};

export const queryConnections = async (queries: NetworkQuery[]) => {
	const networkQueryPromises = queries.map(async (query) => {
		const response = await queryConnection(query);
		return { response };
	});

	// TODO: expand on network condition handling, eg. timeouts, single connection failure
	const networkResults = await Promise.allSettled(networkQueryPromises);
	const networkData = networkResults
		.filter(
			fulfilledPromiseFilter<
				PromiseFulfilledResult<{
					gqlResponse: GQLResponse;
				}>
			>,
		)
		.map((result) => {
			const { response } = result.value;
			return response;
		});
	return networkData;
};

type NetworkQuery = {
	url: string;
	gqlQuery: DocumentNode;
};

/**
 * Find requested field in remote connection supported fields
 *
 * @param config
 * @param fieldName
 * @returns
 */
const findMatchedAggregationField = (config: NetworkAggregationConfig, fieldName: string) => {
	return config.supportedAggregations.find((agg) => agg.name === fieldName);
};

/**
 * Parse central query and build individual queries for remote connections based on available fields
 *
 * @param configs
 * @param info
 * @returns
 */
export const createNetworkQueries = (
	configs: NetworkAggregationConfig[],
	rootQueryFields: string[],
): NetworkQuery[] => {
	// TODO: what if there are no matched findMatchedAggregationField
	const queries = configs
		.map((config) => {
			// construct gql string { [fieldName] { [Aggregation query fields] } }
			const gqlStringFields = rootQueryFields.reduce((gqlString, fieldName) => {
				const matchedAggregationField = findMatchedAggregationField(config, fieldName);
				if (matchedAggregationField) {
					const { name, type } = matchedAggregationField;
					// get gql query string for supported aggregation
					const aggregationFieldQueryString = supportedAggregationQueries.get(type);
					return gqlString + `${name}${aggregationFieldQueryString}`;
				}
				return gqlString;
			}, '');

			// add top level field for query and format with correct brackets
			const gqlString = `{${config.documentName} { ${gqlStringFields} }}`;

			/*
			 * convert string to AST object to use as query
			 * not needed if gqlString is formatted correctly but this acts as a validity check
			 */
			try {
				const gqlQuery = gql`
					${gqlString}
				`;
				return { url: config.graphqlUrl, gqlQuery };
			} catch (err) {
				console.error('invalid gql', err);

				return false;
			}
		})
		.filter(Boolean);
	return queries;
};
