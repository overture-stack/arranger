import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { REMOTE_NODE_FAILURE_TEXTS } from '#network/remoteNodeFailure.js';
import {
	SCHEMA_ANSWER,
	serveRemoteNode,
	unreachableRemoteNodeUrl,
	withConsoleLines,
} from '#network/remoteNodeStub.fixture.js';

import { fetchAllNodeAggregations } from './query.js';

const NODE_NAME = 'remote node';
const REMOTE_DETAIL = 'index [donor_internal_7] is closed';

const remoteNodeAt = (graphqlUrl: string) => ({ displayName: NODE_NAME, documentType: 'donor', graphqlUrl });

/** What startup records for one remote node at `url`, and what it logged. */
const schemaOutcomeFor = async (url: string) => {
	const { lines, result } = await withConsoleLines(() =>
		fetchAllNodeAggregations({ networkConfigs: [remoteNodeAt(url)] }),
	);

	return { lines, outcome: result[0] };
};

/** Asserts a failed node carries `text` and `result` alone, and the log names the node and carries `url`. */
const assertFailedNode = (
	{ lines, outcome }: Awaited<ReturnType<typeof schemaOutcomeFor>>,
	{ result, text, url }: { result: string; text: string; url: string },
) => {
	assert.deepEqual(outcome, { config: remoteNodeAt(url), message: text, result });
	assert.ok(
		lines.some((line) => line.includes('network.node_failed') && line.includes(NODE_NAME) && line.includes(url)),
		`expected a network.node_failed line naming the node and its URL, got ${JSON.stringify(lines)}`,
	);
};

suite(
	"fetchAllNodeAggregations records a remote node's startup failure with a fixed text naming the kind of problem",
	() => {
		test('records a node nothing answers at as unreachable', async () => {
			const url = await unreachableRemoteNodeUrl();

			assertFailedNode(await schemaOutcomeFor(url), {
				result: 'NETWORK_ERROR',
				text: REMOTE_NODE_FAILURE_TEXTS.unreachable,
				url,
			});
		});

		test('records a node answering with an error status as answering with errors', async () => {
			const remote = await serveRemoteNode((_query, response) => {
				response.status(500).json({ errors: [{ message: REMOTE_DETAIL }] });
			});

			try {
				const schemaOutcome = await schemaOutcomeFor(remote.url);

				assertFailedNode(schemaOutcome, {
					result: 'NETWORK_ERROR',
					text: REMOTE_NODE_FAILURE_TEXTS.errors,
					url: remote.url,
				});
				assert.ok(schemaOutcome.lines.some((line) => line.includes(REMOTE_DETAIL)));
			} finally {
				await remote.close();
			}
		});

		test('records a node answering with something other than a schema as answering with data it cannot read', async () => {
			const remote = await serveRemoteNode((_query, response) => {
				response.json({ data: { unexpected: REMOTE_DETAIL } });
			});

			try {
				assertFailedNode(await schemaOutcomeFor(remote.url), {
					result: 'INVALID_DATA',
					text: REMOTE_NODE_FAILURE_TEXTS.unreadable,
					url: remote.url,
				});
			} finally {
				await remote.close();
			}
		});

		test("records a node answering with its schema, with that schema's aggregation fields", async () => {
			const remote = await serveRemoteNode((_query, response) => {
				response.json(SCHEMA_ANSWER);
			});

			try {
				const { outcome } = await schemaOutcomeFor(remote.url);

				assert.deepEqual(outcome, {
					node: { ...remoteNodeAt(remote.url), aggregations: [{ name: 'study', type: 'Aggregations' }] },
					result: 'SUCCESS',
				});
			} finally {
				await remote.close();
			}
		});
	},
);
