import type { CustomRemoteRequestProps } from '@overture-stack/arranger-types/configs';
import { type DocumentNode } from 'graphql';

import { fetchGql } from '#network/gql.js';
import {
	REMOTE_NODE_FAILURE_TEXTS,
	remoteNodeFailureDetailsOf,
	remoteNodeFailureKindOf,
} from '#network/remoteNodeFailure.js';
import { type NetworkQueryVariables } from '#network/resolvers/index.js';
import { type AsyncResult, failure, success } from '#network/result.js';
import { ASTtoString } from '#network/utils/gql.js';
import { SERVER_PROBLEM_MESSAGE } from '#utils/serverProblem.js';

export type RemoteNodeQueryParams = {
	customRequestProps?: CustomRemoteRequestProps;
	gqlQuery: DocumentNode;
	/** The node's display name, naming it in the server log. */
	nodeName: string;
	queryVariables: NetworkQueryVariables;
	url: string;
};

/**
 * Make a GQL Request of a remote connection, then handle the network response.
 *
 * Note: The return data is not validated. This will return the `.data` property of a
 *       successful graphql response.
 *
 * A failure's data is fixed text naming the kind of problem, never the node's URL nor its own messages, which
 * are logged on the server as `network.node_failed`.
 *
 * @param query the node, its URL and the query to send it.
 */
export const fetchData = async (query: RemoteNodeQueryParams): AsyncResult<unknown> => {
	const { customRequestProps, gqlQuery, nodeName, queryVariables, url } = query;

	console.log(`Fetching data starting for ${url}...`);

	try {
		const response = await fetchGql({
			customRequestProps,
			gqlQuery: ASTtoString(gqlQuery),
			url,
			variables: queryVariables,
		});

		// axios response "data" field, graphql response "data" field
		const responseData = response.data?.data;
		if (response.status === 200) {
			console.log(`Fetch data completed for ${url}`);
			return success(responseData);
		}

		// axios throws on an error status, so this is an answer of another success status
		console.error('network.node_failed', {
			kind: 'unreadable',
			node: nodeName,
			status: response.status,
			step: 'query',
			url,
		});
		return failure(REMOTE_NODE_FAILURE_TEXTS.unreadable);
	} catch (error) {
		const kind = remoteNodeFailureKindOf(error);

		console.error('network.node_failed', {
			...remoteNodeFailureDetailsOf(error),
			kind: kind ?? 'server',
			node: nodeName,
			step: 'query',
			url,
		});

		return failure(kind ? REMOTE_NODE_FAILURE_TEXTS[kind] : SERVER_PROBLEM_MESSAGE);
	}
};
