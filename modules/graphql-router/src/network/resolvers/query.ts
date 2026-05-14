import { gql } from 'apollo-server-core';
import { type DocumentNode } from 'graphql';
import { isEmpty } from 'lodash-es';

import type { NetworkRemoteNode } from '#/network/types/setup.js';
import { failure, success, type Result } from '#network/result.js';
import { type RequestedFieldsMap } from '#network/utils/gql.js';

/**
 * Converts info field object into string
 *
 * @param requestedFields - Query fields object
 * @returns GQL string
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
 * Includes aggregation GQL arguments (actual data is sent with query in additional param)
 * Requested fields are converted to GQL style strings
 *
 * This hardcodes an aggregation query for network search
 *
 * @param documentName - Document name in the graphql schema on the node
 * @param requestedFields - Query fields object
 * @returns Fully constructed query string
 */
export const createRemoteNodeGQLQuery = (documentName: string, requestedFields: RequestedFieldsMap) => {
	const fields = convertFieldsToString(requestedFields);
	const queryArgsTypes = !isEmpty(fields)
		? `($filters: JSON, $aggregations_filter_themselves: Boolean, $include_missing: Boolean)`
		: '';
	const fieldQueryArgs = `(filters: $filters, aggregations_filter_themselves: $aggregations_filter_themselves, include_missing: $include_missing)`;
	const aggregationsString = !isEmpty(fields) ? `aggregations${fieldQueryArgs} ${fields}` : '';
	const gqlString = `query nodeQuery${queryArgsTypes} {${documentName} { hits { total } ${aggregationsString} }}`;
	return gqlString;
};

/**
 * Creates a GQL query for fields with query arguments.
 * Only adds requested fields that are available on a node.
 *
 * @param config - Node config
 * @param requestedFields - Fields from query
 * @returns a GQL document node or undefined if a valid GQL document node cannot be created
 */
export const createNetworkQuery = (
	config: NetworkRemoteNode,
	requestedFields: RequestedFieldsMap,
): Result<DocumentNode> => {
	const { aggregations, documentType } = config;

	// ensure requested field is available to query on node
	const fieldsToRequest = Object.keys(requestedFields).reduce((fields, requestedFieldKey) => {
		const field = requestedFields[requestedFieldKey];
		if (aggregations.some((field) => field.name === requestedFieldKey)) {
			return { ...fields, [requestedFieldKey]: field };
		} else {
			return fields;
		}
	}, {});

	const gqlString = createRemoteNodeGQLQuery(documentType, fieldsToRequest);

	/*
	 * convert string to AST object
	 * not needed if gqlString is formatted correctly but this acts as a validity check
	 */
	try {
		const gqlQuery = gql`
			${gqlString}
		`;
		return success(gqlQuery);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Error thrown parsing gql query.';
		console.error('createNetworkQuery generated invalid GQL', error);
		return failure(message);
	}
};
