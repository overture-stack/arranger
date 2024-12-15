import { gql } from 'apollo-server-core';
import axios, { AxiosError } from 'axios';
import { DocumentNode } from 'graphql';
import { isEmpty } from 'lodash';

import { AggregationAccumulator } from '../aggregations/AggregationAccumulator';
import { fetchGql } from '../gql';
import { failure, isSuccess, Result, success } from '../result';
import { Hits } from '../types/hits';
import { AllAggregations, NodeConfig } from '../types/types';
import { ASTtoString, RequestedFieldsMap } from '../utils/gql';
import { CONNECTION_STATUS, NetworkNode } from './networkNode';

type NetworkQuery = {
	url: string;
	gqlQuery: DocumentNode;
	queryVariables: QueryVariables;
};

type QueryVariables = {
	filters?: object;
	aggregations_filter_themselves?: boolean;
	include_missing?: boolean;
};

/**
 * Query remote connections and handle network responses
 *
 * @param query
 * @returns
 */

// narrows type
const isAxiosError = (error: unknown): error is AxiosError => axios.isAxiosError(error);

const fetchData = async <SuccessType>(
	query: NetworkQuery,
): Promise<Result<SuccessType, typeof CONNECTION_STATUS.ERROR>> => {
	const { url, gqlQuery, queryVariables } = query;

	console.log(`Fetch data starting for ${url}`);

	try {
		const response = await fetchGql({
			url,
			gqlQuery: ASTtoString(gqlQuery),
			variables: queryVariables,
		});

		// axios response "data" field, graphql response "data" field
		const responseData = response.data?.data;
		if (response.status === 200 && response.statusText === 'OK') {
			console.log(`Fetch data completing for ${query.url}`);
			return success(responseData);
		}
	} catch (error) {
		if (axios.isCancel(error)) {
			console.log(`Fetch data cancelled for ${query.url}`);
			return failure(CONNECTION_STATUS.ERROR, `Request cancelled: ${url}`);
		}

		if (axios.isAxiosError(error)) {
			const errorResponse = error as AxiosError<{ errors: { message: string }[] }>;

			if (errorResponse.code === 'ECONNREFUSED') {
				console.error(`Network failure: ${url}`);
				return failure(CONNECTION_STATUS.ERROR, `Network failure: ${url}`);
			}

			if (error.response) {
				const errors =
					errorResponse.response &&
					errorResponse.response.data.errors.map((gqlError) => gqlError.message).join('\n');
				console.error(errors);
				return failure(CONNECTION_STATUS.ERROR, 'errors');
			}
		}
		return failure(CONNECTION_STATUS.ERROR, `Unknown error`);
	}
	// TS would like a return value outside of try/catch handling
	return failure(CONNECTION_STATUS.ERROR, `Unknown error`);
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
 * Creates individual GQL query string for a node.
 * Includes aggregation GQL arguments (actual data is provided alongside query, not here)
 * Requested fields are converted to GQL style strings
 *
 * @param documentName
 * @param requestedFields
 * @returns constructed query string
 */
export const createNodeQueryString = (
	documentName: string,
	requestedFields: RequestedFieldsMap,
) => {
	const fields = convertFieldsToString(requestedFields);
	const aggregationsString = !isEmpty(fields) ? `aggregations  ${fields}` : '';
	const gqlString = `query nodeQuery {${documentName} { hits { total }  ${aggregationsString} }}`;
	return gqlString;
};

/**
 * Creates a GQL query for fields with query arguments.
 * Only adds requested fields that are available on a node.
 *
 * @param config
 * @param requestedFields
 * @returns a GQL document node or undefined if a valid GQL document node cannot be created
 */
export const createNetworkQuery = (
	config: NodeConfig,
	requestedFields: RequestedFieldsMap,
): DocumentNode | undefined => {
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
		return undefined;
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
	queryVariables: QueryVariables,
) => {
	const nodeInfo: NetworkNode[] = [];

	const totalAgg = new AggregationAccumulator(requestedAggregationFields);

	const aggregationResultPromises = configs.map(async (config) => {
		const gqlQuery = createNetworkQuery(config, requestedAggregationFields);
		const response = gqlQuery
			? await fetchData<SuccessResponse>({
					url: config.graphqlUrl,
					gqlQuery,
					queryVariables,
			  })
			: failure(CONNECTION_STATUS.ERROR, 'Invalid GQL query');

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
