import { gql } from 'apollo-server-core';
import axios from 'axios';
import { DocumentNode } from 'graphql';
import { isEmpty } from 'lodash';
import { AggregationAccumulator } from '../aggregations/AggregationAccumulator';
import { fetchGql } from '../gql';
import { failure, isSuccess, Result, Success, success } from '../httpResponses';
import { Hits } from '../types/hits';
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
	const { url, gqlQuery, args } = query;

	console.log(`Fetch data starting for ${url}`);

	try {
		const response = await fetchGql({
			url,
			gqlQuery: ASTtoString(gqlQuery),
			variables: args,
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
	args: Record<string, unknown>;
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

/**
 * Query string creation
 *
 * @param documentName
 * @param requestedFields
 * @returns
 */
export const createNodeQueryString = (
	documentName: string,
	requestedFields: RequestedFieldsMap,
) => {
	const fields = convertFieldsToString(requestedFields);
	const aggregationsString = !isEmpty(fields)
		? `aggregations(filters: $filters, aggregations_filter_themselves: $aggregations_filter_themselves) ${fields}`
		: '';
	const gqlString = `query nodeQuery($filters: JSON, $aggregations_filter_themselves: Boolean) {${documentName} { hits { total }  ${aggregationsString} }}`;
	return gqlString;
};

/**
 * Creates a GQL query for fields with query arguments.
 * Only adds requested fields that are available on a node.
 *
 * @param config
 * @param requestedFields
 * @returns
 */
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
	 * convert string to AST object
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
	args: Record<string, unknown>,
) => {
	const nodeInfo: NetworkNode[] = [];

	const totalAgg = new AggregationAccumulator(requestedAggregationFields);

	const aggregationResultPromises = configs.map(async (config) => {
		const gqlQuery = createNetworkQuery(config, requestedAggregationFields);
		const response = await fetchData<SuccessResponse>({ url: config.graphqlUrl, gqlQuery, args });

		const nodeName = config.displayName;

		if (isSuccess(response)) {
			const documentName = config.documentName;
			const responseData = response.data[documentName];
			const aggregations = responseData?.aggregations || {};
			const hits = responseData?.hits || { total: 0 };

			totalAgg.resolve({ aggregations, hits });

			nodeInfo.push({
				name: nodeName,
				hits: hits.total,
				status: CONNECTION_STATUS.OK,
				errors: '',
				aggregations: config.aggregations,
			});
		} else {
			nodeInfo.push({
				name: nodeName,
				hits: 0,
				status: CONNECTION_STATUS.ERROR,
				errors: response?.message || 'Error',
				aggregations: config.aggregations,
			});
		}
	});

	// return accumulated results
	await Promise.allSettled(aggregationResultPromises);
	return { aggregationResults: totalAgg.result(), nodeInfo };
};
