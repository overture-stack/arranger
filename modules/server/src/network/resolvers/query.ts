import { gql } from 'apollo-server-core';
import { DocumentNode } from 'graphql';
import { isEmpty } from 'lodash';

import { NodeConfig } from '../setup/query';
import { RequestedFieldsMap } from '../utils/gql';

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
 * @param documentName - File type document name configured on node
 * @param requestedFields - Query fields object
 * @returns Fully constructed query string
 */
export const createFileGQLQuery = (documentName: string, requestedFields: RequestedFieldsMap) => {
	const fields = convertFieldsToString(requestedFields);
	const queryArgsTypes = `($filters: JSON, $aggregations_filter_themselves: Boolean, $include_missing: Boolean)`;
	const fieldQueryArgs = `(filters: $filters, aggregations_filter_themselves: $aggregations_filter_themselves, include_missing: $include_missing)`;
	const aggregationsString = !isEmpty(fields) ? `aggregations${fieldQueryArgs} ${fields}` : '';
	const gqlString = `query nodeQuery${queryArgsTypes} {${documentName} { hits { total }  ${aggregationsString} }}`;
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
	config: NodeConfig,
	requestedFields: RequestedFieldsMap,
): DocumentNode | undefined => {
	const availableFields = config.aggregations;
	const documentName = config.documentName;

	// ensure requested field is available to query on node
	const fieldsToRequest = Object.keys(requestedFields).reduce((fields, requestedFieldKey) => {
		const field = requestedFields[requestedFieldKey];
		if (availableFields.some((field) => field.name === requestedFieldKey)) {
			return { ...fields, [requestedFieldKey]: field };
		} else {
			return fields;
		}
	}, {});

	const gqlString = createFileGQLQuery(documentName, fieldsToRequest);

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
