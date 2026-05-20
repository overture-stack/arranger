import type { CustomizeRemoteRequestFn } from '@overture-stack/arranger-types/configs';
import { Kind, type FieldNode, type GraphQLObjectType, type GraphQLResolveInfo } from 'graphql';
import graphqlFields from 'graphql-fields';

import { type AggregationsQueryVariables, type AllAggregationsMap } from '#mapping/resolveAggregations.js';
import { AggregationAccumulator } from '#network/aggregations/AggregationAccumulator.js';
import { fetchData } from '#network/resolvers/fetch.js';
import { createNetworkQuery } from '#network/resolvers/query.js';
import { type Hits } from '#network/types/hits.js';
import type { NetworkLocalNode, NetworkRemoteNode } from '#network/types/setup.js';
import type { RequestedFieldsMap } from '#network/utils/gql.js';
import type { ArrangerBaseContext } from '#types.js';

export const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;

export type NetworkNodeResponseData = {
	name: string;
	hits: number;
	status: keyof typeof CONNECTION_STATUS;
	errors: string;
	aggregations: { name: string; type: string }[];
};

type SuccessResponse = Record<string, { hits: Hits; aggregations: AllAggregationsMap }>;

/**
 * Query each network node then combine the results into total aggregations.
 * This will also return the total hits for each node separate from the aggregations.
 */
export const aggregationPipeline = async <Context extends ArrangerBaseContext>(params: {
	context: Context;
	customRemoteRequestFn?: CustomizeRemoteRequestFn<Context>;
	graphqlResolveInfo: GraphQLResolveInfo;
	localNodes: NetworkLocalNode<Context>[];
	queryVariables: AggregationsQueryVariables;
	remoteNodes: NetworkRemoteNode[];
	requestedAggregationFields: RequestedFieldsMap;
}): Promise<{
	aggregationResults: AllAggregationsMap;
	nodeInfo: Omit<NetworkNodeResponseData, 'aggregations'>[];
}> => {
	const {
		context,
		customRemoteRequestFn,
		graphqlResolveInfo,
		localNodes,
		queryVariables,
		remoteNodes,
		requestedAggregationFields,
	} = params;

	const nodeInfo: Omit<NetworkNodeResponseData, 'aggregations'>[] = [];

	const aggregationAccumulator = new AggregationAccumulator(requestedAggregationFields);

	/**
	 * Remote Node Queries
	 *
	 * Initiate the queries to remote nodes and collect the promises, they will be awaited at the end before
	 * collecting the results and returning.
	 */
	const remoteNodePromises = remoteNodes.map(async (config) => {
		try {
			// create node query
			// TODO: do not run query if we are only requesting node info stored in our configs, with no hits or aggregations requested
			const gqlQueryResult = createNetworkQuery(config, requestedAggregationFields);
			if (!gqlQueryResult.success) {
				console.warn(
					`Cannot make request to remote node ${config.displayName} due to failure creating gql query.`,
				);
				return;
			}

			// query node
			const gqlQuery = gqlQueryResult.data;
			const response = await fetchData({
				customRequestProps: customRemoteRequestFn?.({ context, remoteNode: config }),
				url: config.graphqlUrl,
				gqlQuery,
				queryVariables,
			});

			const nodeName = config.displayName;

			if (response.success) {
				const documentName = config.documentType;
				// TODO: Response content is not validated, we expect the return structure based on the GraphQL query we requested
				const responseData = (response.data as SuccessResponse)[documentName];
				const aggregations = responseData?.aggregations || {};
				const hits = responseData?.hits || { total: 0 };

				aggregationAccumulator.resolve({ aggregations, hits });

				nodeInfo.push({
					name: nodeName,
					hits: hits.total,
					status: CONNECTION_STATUS.OK,
					errors: '',
				});
			} else {
				nodeInfo.push({
					name: nodeName,
					hits: 0,
					status: CONNECTION_STATUS.ERROR,
					errors: response.data ?? 'Error',
				});
			}
		} catch (error) {
			// This is added as an extra protection. We do not expect to get here, all functions should be catching thrown errors
			// and returning Results, but in case someting gets missed we want to capture the issue.

			// Log the error and update the nodeInfo
			console.error(
				`[network/aggregationPipeline] - Error with network query while fetching data from '${config.displayName}' at graphqlUrl: ${config.graphqlUrl} - ${error}`,
			);

			const message =
				error instanceof Error ? error.message : 'Unexpected error while fetching data from this node.';

			nodeInfo.push({
				name: config.displayName,
				errors: message,
				hits: 0,
				status: 'ERROR',
			});
		}
	});

	/*
	 * Local Node Queries
	 * Initiate the queries to all local nodes and collect the promises, they will be awaited at the end before
	 * collecting the results and returning.
	 */
	const localNodePromises = localNodes.map(async (config) => {
		/**
		 * `localNodeStatusInfo`is the nodeInfo object for this local node. This will be modified
		 *   by the hits and aggregations queries to track errors that occur (if any) and also provide
		 *   the total hits for the node.
		 *
		 * Here we set defaults that may be overwritten after the hits and aggregation queries.
		 */
		const localNodeStatusInfo: Omit<NetworkNodeResponseData, 'aggregations'> = {
			errors: '',
			hits: 0,
			name: config.displayName,
			status: 'OK',
		};

		/*
		 * Query Hits
		 *
		 * Use the local node's hits resolver to determine the number of hits on this node,
		 * and update the localNodeOutputInfo with this value.
		 *
		 * First, check if nodes.hits were requested and only run if needed.
		 */
		// check if the graphqlResolveInfo includes a request for total hits
		const requestedFields = graphqlFields(graphqlResolveInfo);
		const nodesHitsRequested = requestedFields?.nodes?.hits !== undefined;
		if (nodesHitsRequested) {
			try {
				// Create the hits query argument object for the hits resolver.
				// Args are based on the inputs to the function returned in resolveHits.js:
				// Reference as of May 11, 2026 - { first = 10, offset = 0, filters, score, sort, searchAfter, trackTotalHits = true },
				const hitsQueryArgs = {
					// Important Values
					filters: queryVariables.filters,
				};

				// Make sure we call this hits resolver within a try/catch since we are assuming its input shape is that of the arranger
				// hits resolver (and there is no check here to confirm)
				const hitsResult = await config.resolvers.hits({}, hitsQueryArgs, context, graphqlResolveInfo);
				localNodeStatusInfo.hits = hitsResult.total();
			} catch (error: unknown) {
				// Failed to resolve hits, set error status and keep hits as 0
				console.error(
					`[network/aggregationPipeline] - Error resolving hits on local node '${config.displayName}' with catalogId '${config.catalogId}' - ${error}`,
				);

				const errorMessage =
					error instanceof Error
						? error.message
						: 'Unexpected error while resolving total hits for this node, the final hits value will be reported as 0.';

				localNodeStatusInfo.status = 'ERROR';
				localNodeStatusInfo.errors = localNodeStatusInfo.errors
					? [localNodeStatusInfo.errors, errorMessage].join(' | ')
					: errorMessage;
			}
		}

		/*
		 * Query Aggregations
		 *
		 * Use the local node's aggregation resolver to determine the field aggregations for this node.
		 *
		 * First, check if aggregations were requested and only run if needed.
		 */
		// Get the aggregations request info from the original gql query
		const aggregationsFieldNode = graphqlResolveInfo.fieldNodes[0]?.selectionSet?.selections.find(
			(selection): selection is FieldNode =>
				selection.kind === Kind.FIELD && selection.name.value === 'aggregations',
		);
		const aggregationsReturnType = (graphqlResolveInfo.returnType as GraphQLObjectType).getFields()['aggregations']
			?.type;

		// only proceed if the gqlresolve info has an aggregatios node, indicating a request for aggregation data
		if (aggregationsFieldNode && aggregationsReturnType) {
			try {
				const aggregationsInfo: GraphQLResolveInfo = {
					...graphqlResolveInfo,
					fieldName: 'aggregations',
					fieldNodes: aggregationsFieldNode ? [aggregationsFieldNode] : [],
					returnType: aggregationsReturnType,
					path: { prev: graphqlResolveInfo.path, key: 'aggregations', typename: undefined },
				};

				const aggregations = await config.resolvers.aggregations({}, queryVariables, context, aggregationsInfo);
				const hits = { total: localNodeStatusInfo.hits };

				aggregationAccumulator.resolve({ aggregations, hits });
			} catch (error: unknown) {
				// Failed to resolve aggregations, set error status
				console.error(
					`[network/aggregationPipeline] - Error resolving aggregations on local node '${config.displayName}' with catalogId '${config.catalogId}' - ${error}`,
				);

				const errorMessage =
					error instanceof Error
						? error.message
						: 'Unexpected error while resolving aggregations for this node.';

				localNodeStatusInfo.status = 'ERROR';
				localNodeStatusInfo.errors = localNodeStatusInfo.errors
					? [localNodeStatusInfo.errors, errorMessage].join(' | ')
					: errorMessage;
			}
		}

		// Add this local node status info to the collected array.
		nodeInfo.push(localNodeStatusInfo);
	});

	// Await for all query promises to resolve
	await Promise.allSettled([...remoteNodePromises, ...localNodePromises]);

	// sort nodeInfo array by displayName instead of having all remote before all local nodes
	nodeInfo.sort((a, b) => (a.name > b.name ? 1 : -1));

	return { aggregationResults: aggregationAccumulator.result(), nodeInfo };
};
