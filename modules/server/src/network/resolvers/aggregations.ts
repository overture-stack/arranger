import { gql } from 'apollo-server-core';
import { DocumentNode, GraphQLResolveInfo } from 'graphql';
import graphqlFields from 'graphql-fields';
import { fetchGql } from '../gql';
import { supportedAggregationQueries } from '../queries';
import { NetworkAggregationConfig } from '../types';
import { ASTtoString } from '../util';

/**
 * Returns only top level fields from a GQL request
 *
 * @param info GQL request info object
 * @returns List of top level fields
 */
const getRootFields = (info: GraphQLResolveInfo) => {
	const requestedFields = graphqlFields(info);
	const fieldsAsList = Object.keys(requestedFields);
	return fieldsAsList;
};

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
		/**
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
	return networkResults;
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
	info: GraphQLResolveInfo,
): NetworkQuery[] => {
	const rootQueryFields = getRootFields(info);

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
