import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { parse } from 'graphql';

import { REMOTE_NODE_FAILURE_TEXTS } from '#network/remoteNodeFailure.js';
import { serveRemoteNode, withConsoleLines, withUnreachableRemoteNode } from '#network/remoteNodeStub.fixture.js';

import { fetchData } from './fetch.js';

const NODE_NAME = 'remote node';
const REMOTE_DETAIL = 'index [donor_internal_7] is closed';
const NODE_QUERY = parse('query nodeQuery($filters: JSON) { donor { hits(filters: $filters) { total } } }');
const QUERY_VARIABLES = { aggregations_filter_themselves: false, filters: {}, include_missing: true };

const fetchFrom = (url: string) =>
	withConsoleLines(() =>
		fetchData({ gqlQuery: NODE_QUERY, nodeName: NODE_NAME, queryVariables: QUERY_VARIABLES, url }),
	);

/** Asserts the failure answers `text` alone, and the server log names the node and carries each of `details`. */
const assertFailure = (
	{ lines, result }: Awaited<ReturnType<typeof fetchFrom>>,
	{ details, text }: { details: string[]; text: string },
) => {
	assert.deepEqual(result, { case: 'ERROR', data: text, success: false });
	assert.ok(
		lines.some(
			(line) =>
				line.includes('network.node_failed') &&
				line.includes(NODE_NAME) &&
				details.every((detail) => line.includes(detail)),
		),
		`expected a network.node_failed line naming the node and carrying ${JSON.stringify(details)}, got ${JSON.stringify(lines)}`,
	);
};

suite("fetchData answers a remote node's failure with a fixed text naming the kind of problem", () => {
	test('answers a node nothing answers at as unreachable, logging its URL', async () => {
		// Given a URL nothing answers at
		await withUnreachableRemoteNode(async (url) => {
			// When the node is queried
			const outcome = await fetchFrom(url);

			// Then the failure says the node could not be reached, and only the log carries the URL
			assertFailure(outcome, { details: [url], text: REMOTE_NODE_FAILURE_TEXTS.unreachable });
		});
	});

	test("answers a node answering with GraphQL errors as answering with errors, logging the node's own messages", async () => {
		// Given a node answering every query with an error status and its own message
		const remote = await serveRemoteNode((_query, response) => {
			response.status(400).json({ errors: [{ message: REMOTE_DETAIL }] });
		});

		try {
			// When the node is queried
			const outcome = await fetchFrom(remote.url);

			// Then the failure says the node answered with errors, and only the log carries its message and URL
			assertFailure(outcome, { details: [REMOTE_DETAIL, remote.url], text: REMOTE_NODE_FAILURE_TEXTS.errors });
		} finally {
			await remote.close();
		}
	});

	test('answers a node answering with an error status and no GraphQL body as answering with errors', async () => {
		// Given a node answering every query with a plain-text error
		const remote = await serveRemoteNode((_query, response) => {
			response.status(502).type('text/plain').send(`Bad Gateway: ${REMOTE_DETAIL}`);
		});

		try {
			// When the node is queried
			const outcome = await fetchFrom(remote.url);

			// Then the failure says the node answered with errors
			assertFailure(outcome, { details: [remote.url], text: REMOTE_NODE_FAILURE_TEXTS.errors });
		} finally {
			await remote.close();
		}
	});

	test('serves the data a node answers successfully', async () => {
		// Given a node answering with data
		const remote = await serveRemoteNode((_query, response) => {
			response.json({ data: { donor: { hits: { total: 3 } } } });
		});

		try {
			// When the node is queried
			const { result } = await fetchFrom(remote.url);

			// Then its data is served
			assert.deepEqual(result, { case: 'SUCCESS', data: { donor: { hits: { total: 3 } } }, success: true });
		} finally {
			await remote.close();
		}
	});
});
