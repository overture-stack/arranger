import { type NodeConfig, type RemoteNodeConfig } from '@overture-stack/arranger-types/configs';
import { isAxiosError } from 'axios';

import { fetchGql } from '#network/gql.js';
import { type AggregationField, type NetworkRemoteNode } from '#network/types/setup.js';
import { isFulfilledPromise } from '#network/utils/promise.js';

type NetworkQueryResult = PromiseFulfilledResult<{
	config: NetworkRemoteNode;
	gqlResponse: GQLTypeQueryResponse;
}>;

type GQLFieldType = {
	name: string;
	type: {
		name: string;
	};
};

type GQLTypeQueryResponse = {
	__type: {
		name: string;
		fields: GQLFieldType[];
	};
};

/**
 * Query to get field types
 * eg. __type('aggregations')
 */
const gqlAggregationTypeQuery = `#graphql
	query getAggregationTypes($documentTypeName: String!) {
		__type(name: $documentTypeName) {
			name
			fields {
				name
				type {
					name
				}
			}
		}
	}
`;

/**
 * Unnests graphql field
 * { name: 'donor_gender', type: { name: 'Aggregation' }}
 *  =>
 * { name: 'donor_gender', type: 'Aggregation'}
 *
 * @param gqlField - Nested field object
 * @returns An unnested object containing field name and type
 */
const normalizeGqlField = (gqlField: GQLFieldType): AggregationField => {
	const type = gqlField.type.name;
	const name = gqlField.name;

	return { name, type };
};

export type FetchAggregationSuccess = { result: 'SUCCESS'; node: NetworkRemoteNode };
export type FetchAggregationInvalidData = { result: 'INVALID_DATA'; config: RemoteNodeConfig; message: string };
export type FetchAggregationNetworkError = { result: 'NETWORK_ERROR'; config: RemoteNodeConfig; message: string };
export type FetchAggregationResult =
	| FetchAggregationSuccess
	| FetchAggregationInvalidData
	| FetchAggregationNetworkError;

/**
 * GQL query remote connection with __type query to retrieve list of types
 *
 * @param config - RemoteNodeConfig for network aggregation search
 * @returns On success, returns the NetworkAggregationNode including its NodeConfig and AggregationFields. This could return
 *          a failure result due to network error or unexpected response data format.
 */
const fetchNodeAggregations = async (config: RemoteNodeConfig): Promise<FetchAggregationResult> => {
	const { graphqlUrl, documentType } = config;
	/**
	 * documentType is an entire field name / type name in the case of a root field
	 * eg. `file:file`, `torontoFile:torontoFile`
	 * Arranger also constructs dynamic type names like *Connection and *Aggregations
	 * eg. `aggregations: fileAggregations`, `hits: fileConnection`
	 */
	try {
		// targeting just the "aggregations" field using type name
		const typename = `${documentType}Aggregations`;
		const response = await fetchGql({
			url: graphqlUrl,
			gqlQuery: gqlAggregationTypeQuery,
			variables: { documentTypeName: typename },
		});

		if (response.status === 200 && response.statusText === 'OK') {
			// axios response "data" field containing graphql response "data" field
			// Note: This is unsafe property access, it will be caught and returned as 'INVALID_DATA' if the sturcutre is invalid.
			const responseData = response.data.data;
			const fields = responseData.__type.fields;
			const aggregations = fields.map(normalizeGqlField);
			console.info(
				`Successfully fetched schema for remote node '${config.displayName}' located at ${config.graphqlUrl}`,
			);
			return { result: 'SUCCESS', node: { ...config, aggregations } };
		}

		console.error('Unexpected response data in fetchRemoteSchema');
		throw new Error(
			`Unexpected data in response object. Please verify the endpoint at ${graphqlUrl} is returning a valid GQL Schema.`,
		);
	} catch (error) {
		console.error(
			`\nFailed to retrieve schema for node '${config.displayName}' from graphqlUrl: ${config.graphqlUrl}`,
		);
		console.error(
			`  Check that the graphqlUrl and documentType '${documentType}' for this node are both correct.\n`,
		);
		if (isAxiosError(error)) {
			return { result: 'NETWORK_ERROR', config, message: error.message };
		}
		const message = error instanceof Error ? error.message : `Unexpected error fetching node aggregations.`;
		return { result: 'INVALID_DATA', config, message };
	}
};

/**
 * Fetch fields and types from remote connections
 * @param { networkConfigs }
 * @returns GQL object type to be used in functions
 */
export const fetchAllNodeAggregations = async ({
	networkConfigs,
}: {
	networkConfigs: RemoteNodeConfig[];
}): Promise<FetchAggregationResult[]> => {
	// query remote connection aggregations, let resolve in parallel and this will resume once all are settled
	const queryResults = await Promise.allSettled(networkConfigs.map(fetchNodeAggregations));

	// We expect all the queryResults to fulfill since `fetchNodeAggregations` catches all errors and does not throw,
	// the following is extra precaution to capture any unexpected behaviours
	const fulfilledQueryResults = queryResults.filter(isFulfilledPromise);
	if (fulfilledQueryResults.length < queryResults.length) {
		const rejectedQueryResults = queryResults.filter((result) => !isFulfilledPromise(result));
		// Log this unexpected outcome
		console.warn(
			`Unexpected code branch reached while fetching node aggregations, ${queryResults.length - fulfilledQueryResults.length} queries were rejected!`,
		);
		// Log specific rejection details
		rejectedQueryResults.forEach((result) => {
			console.warn(
				`A promise for 'fetchNodeAggregations' has failed to resolve with the status '${result.status}' and reason: ${result.reason}`,
			);
		});
	}

	const nodeConfigs = fulfilledQueryResults.map<FetchAggregationResult>((settledPromise) => settledPromise.value);

	console.log('\nFinished fetching remote node schemas!\n');

	return nodeConfigs;
};
