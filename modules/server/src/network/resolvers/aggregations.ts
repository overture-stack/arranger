import { gql } from 'apollo-server-core';
import axios from 'axios';
import { DocumentNode } from 'graphql';
import { AggregationAccumulator } from '../aggregations/AggregationAccumulator';
import { fetchGql } from '../gql';
import { failure, isSuccess, Result, success } from '../httpResponses';
import { NetworkConfig } from '../types/setup';
import { ASTtoString, RequestedFieldsMap } from '../util';
import { CONNECTION_STATUS, NetworkNode } from './networkNode';

/**
 * Query remote connections and handle network responses
 *
 * @param query
 * @returns
 */
const fetchData = async (
	query: NetworkQuery,
): Promise<Result<unknown, typeof CONNECTION_STATUS.error>> => {
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
		if (axios.isCancel(error)) {
			return failure(CONNECTION_STATUS.ERROR, `Request cancelled: ${url}`);
		}

		if (axios.isAxiosError(error)) {
			if (error.code === 'ECONNREFUSED') {
				console.error(`Network failure: ${url}`);
				return failure(CONNECTION_STATUS.ERROR, `Network failure: ${url}`);
			}
		}
		return failure(CONNECTION_STATUS.ERROR, `Unknown error`);
	} finally {
		console.log(`Fetch data completing for ${query.url}`);
	}
};

type NetworkQuery = {
	url: string;
	gqlQuery: DocumentNode;
};

/**
 * Converts info field object into string
 *
 * @param requestedFields
 *
 * @example
 * ### Input
 * ```
 * { donors: {
 *     buckets: {
 *       bucket_count: {},
 *     }
 * }}
 * ```
 *
 * ### Output
 * ```
 * `
 * { donors {
 *     buckets {
 *       bucket_count
 *     }
 * }}
 * `
 * ```
 */
const convertFieldsToString = (requestedFields: RequestedFieldsMap) => {
	const gqlFieldsString = JSON.stringify(requestedFields)
		.replaceAll('"', '')
		.replaceAll(':', '')
		.replaceAll('{}', '')
		.replaceAll(',', ' ')
		.replaceAll('\\', ' ');

	return gqlFieldsString;
};

export const createNodeQueryString = (
	documentName: string,
	requestedFields: RequestedFieldsMap,
) => {
	const fields = convertFieldsToString(requestedFields);
	const gqlString = `{${documentName} { hits { total }  aggregations ${fields} }}`;
	return gqlString;
};

const createNetworkQuery = (
	documentName: string,
	requestedFields: RequestedFieldsMap,
): DocumentNode => {
	const gqlString = createNodeQueryString(documentName, requestedFields);

	/*
	 * convert string to AST object to use as query
	 * not needed if gqlString is formatted correctly but this acts as a validity check
	 */
	try {
		const gqlQuery = gql`
			${gqlString}
		`;
		return gqlQuery;
	} catch (err) {
		console.error('invalid gql', err);
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
	configs: NetworkConfig[],
	requestedAggregationFields: RequestedFieldsMap,
) => {
	const nodeInfo: NetworkNode[] = [];

	const totalAgg = new AggregationAccumulator(requestedAggregationFields);

	const aggregationResultPromises = configs.map(async (config) => {
		const gqlQuery = createNetworkQuery(config.documentName, requestedAggregationFields);
		const response = await fetchData({ url: config.graphqlUrl, gqlQuery });

		const nodeName = config.displayName;

		if (isSuccess(response)) {
			totalAgg.resolve(response.data);
			nodeInfo.push({
				name: nodeName,
				count: 1, // TODO total { hit } in query,
				status: CONNECTION_STATUS.OK,
				errors: '',
			});
		} else {
			nodeInfo.push({
				name: nodeName,
				count: 0,
				status: CONNECTION_STATUS.ERROR,
				errors: response?.message || 'Error',
			});
		}
	});

	// return accumulated results
	await Promise.allSettled(aggregationResultPromises);
	return { aggregationResults: totalAgg.result(), nodeInfo };
};
