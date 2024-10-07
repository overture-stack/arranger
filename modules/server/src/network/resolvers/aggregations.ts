import { gql } from 'apollo-server-core';
import axios from 'axios';
import { DocumentNode } from 'graphql';
import { AggregationAccumulator } from '../aggregations/AggregationAccumulator';
import { fetchGql } from '../gql';
import { failure, isSuccess, Result, Success, success } from '../httpResponses';
import { Hits } from '../types/hits';
import { NetworkConfig } from '../types/setup';
import { AllAggregations, NodeConfig } from '../types/types';
import { ASTtoString, RequestedFieldsMap } from '../util';
import { CONNECTION_STATUS, NetworkNode } from './networkNode';

/**
 * Query remote connections and handle network responses
 *
 * @param query
 * @returns
 */
const fetchData = async <SuccessType>(
	query: NetworkQuery,
): Promise<Result<SuccessType, typeof CONNECTION_STATUS.error>> => {
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
			console.error(error.toJSON());

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

export const createNetworkQuery = (
	config: NodeConfig,
	requestedFields: RequestedFieldsMap,
): DocumentNode => {
	const availableFields = config.aggregations;
	const documentName = config.documentName;

	// ensure requested field is available to query on node
	const fieldsToRequest = Object.keys(requestedFields).reduce((acc, requestedFieldKey) => {
		const field = requestedFields[requestedFieldKey];
		if (availableFields.some((field) => field.name === requestedFieldKey)) {
			return { ...acc, [requestedFieldKey]: field };
		} else {
			return acc;
		}
	}, {});

	const gqlString = createNodeQueryString(documentName, fieldsToRequest);

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

type SuccessResponse = { [k: string]: { hits: Hits; aggregations: AllAggregations } };

/**
 * Query each remote connection
 *
 * @param queries - Query for each remote connection
 * @param requestedAggregationFields
 * @returns
 */
export const aggregationPipeline = async (
	configs: NodeConfig[],
	requestedAggregationFields: RequestedFieldsMap,
) => {
	const nodeInfo: NetworkNode[] = [];

	const totalAgg = new AggregationAccumulator();

	const aggregationResultPromises = configs.map(async (config) => {
		const gqlQuery = createNetworkQuery(config, requestedAggregationFields);
		const response = await fetchData<SuccessResponse>({ url: config.graphqlUrl, gqlQuery });

		const nodeName = config.displayName;
		const nodeAvailableAggregations = config.aggregations;

		if (isSuccess(response)) {
			const documentName = config.documentName;
			const aggregationData = response.data[documentName]?.aggregations || {};
			const hitsData = response.data[documentName]?.hits || { total: 0 };

			totalAgg.resolve(aggregationData);
			nodeInfo.push({
				name: nodeName,
				hits: hitsData.total,
				status: CONNECTION_STATUS.OK,
				errors: '',
				aggregations: nodeAvailableAggregations,
			});
		} else {
			nodeInfo.push({
				name: nodeName,
				hits: 0,
				status: CONNECTION_STATUS.ERROR,
				errors: response?.message || 'Error',
				aggregations: nodeAvailableAggregations,
			});
		}
	});

	// return accumulated results
	await Promise.allSettled(aggregationResultPromises);
	return { aggregationResults: totalAgg.result(), nodeInfo };
};
