import { gql } from 'apollo-server-core';
import { DocumentNode } from 'graphql';
import { resolveAggregations } from '../aggregations';
import { fetchGql } from '../gql';
import { failure, isSuccess, success } from '../httpResponses';
import { GQLResponse, supportedAggregationQueries } from '../queries';
import { NetworkAggregation, NetworkAggregationConfig } from '../types';
import { ASTtoString, fulfilledPromiseFilter } from '../util';
import { CONNECTION_STATUS, RemoteConnection } from './remoteConnections';

/**
 * Query remote connections and handle network responses
 *
 * @param query
 * @returns
 */
const fetchData = async (query: NetworkQuery) => {
	const { url, gqlQuery } = query;
	console.log(`Fetch data starting for ${url}`);
	try {
		const response = await fetchGql({
			url,
			gqlQuery: ASTtoString(gqlQuery),
		});

		// axios response "data" field, graphql response "data" field
		const responseData = response.data?.data;
		if (response.status === 200 && response.statusText === 'OK') {
			return success(responseData);
		}
	} catch (error) {
		const responseStatus = error.response.status;
		if (responseStatus === 404) {
			console.error(`Network failure: ${url}`);
			return failure(CONNECTION_STATUS.ERROR, `Network failure: ${url}`);
		} else {
			return failure(CONNECTION_STATUS.ERROR, `Unknown error`);
		}
	} finally {
		console.log(`Fetch data completing for ${query.url}`);
	}
};

/**
 * Query each remote connection
 *
 * @param queries - Query for each remote connection
 * @param requestedAggregationFields
 * @returns
 */
export const aggregationPipeline = async (
	queries: NetworkQuery[],
	requestedAggregationFields: any,
) => {
	/*
	 * seed accumulator with the requested field keys
	 * this will make it easier to add to because we can do key lookup instead of Array.find
	 */
	const emptyAggregation: NetworkAggregation = { bucket_count: 0, buckets: [] };
	const aggregationAccumulator = requestedAggregationFields.reduce((accumulator, field) => {
		return { ...accumulator, [field]: emptyAggregation };
	}, {});

	const aggregationResultPromises = queries.map<
		Promise<{
			aggregations: any;
			remoteConnection: RemoteConnection;
		}>
	>(async (query) => {
		const name = query.url; // TODO: use readable name not url
		const response = await fetchData(query);

		// 		// instead of return response mergeField() // to clearly manipulate the accumlators

		// if (response && isSuccess(response)) {
		// 	resolveAggregations({
		// 		networkResult: response.data,
		// 		requestedAggregationFields,
		// 		accumulator: aggregationAccumulator,
		// 	});
		// }

		return response && isSuccess(response)
			? {
					aggregations: resolveAggregations({
						networkResult: response.data,
						requestedAggregationFields,
						accumulator: aggregationAccumulator,
					}),
					remoteConnection: {
						name,
						count: 0,
						status: CONNECTION_STATUS.OK,
						errors: '',
					},
			  }
			: {
					aggregations: [],
					remoteConnection: {
						name,
						count: 0,
						status: CONNECTION_STATUS.ERROR,
						errors: response?.message || 'Error',
					},
			  };
	});

	Promise.allSettled(aggregationResultPromises).then((data) => {
		// return accumulators
		console.log('settled', aggregationAccumulator);
		return aggregationAccumulator;
	});
};

type NetworkQuery = {
	url: string;
	gqlQuery: DocumentNode;
};

/**
 * Find requested field in remote connection supported fields
 * all nodes may not have all fields
 *
 * @param config
 * @param fieldName
 * @returns
 */
const findMatchedAggregationField = (config: NetworkAggregationConfig, fieldName: string) => {
	return config.supportedAggregations.find((agg) => agg.name === fieldName);
};

/**
 * construct gql string { [fieldName] { [Aggregation query fields] } }
 *
 * @param requestedAggregations
 */
const createGqlFieldsString = (config: NetworkAggregationConfig, requestedAggregations: any[]) => {
	return requestedAggregations.reduce((gqlString, fieldName) => {
		const matchedAggregationField = findMatchedAggregationField(config, fieldName);
		if (matchedAggregationField) {
			const { name, type } = matchedAggregationField;
			// get gql query string for supported aggregation
			// TODO: only query requested fields + bucket_count if nodes is requested
			const aggregationFieldQueryString = supportedAggregationQueries.get(type);
			return gqlString + `${name}${aggregationFieldQueryString}`;
		}
		return gqlString;
	}, '');
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
	requestedAggregations: string[],
): NetworkQuery[] => {
	// TODO: what if there are no matched findMatchedAggregationField
	const queries = configs
		.map((config) => {
			const gqlStringFields = createGqlFieldsString(config, requestedAggregations);

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
