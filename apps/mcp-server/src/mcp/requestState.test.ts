import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type ServerContext } from '@modelcontextprotocol/server';

import { createConfirmationCodec, digestApprovedQuery, type ApprovedQuery } from '#mcp/requestState.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

/** Fixed HMAC key so a codec built here is deterministic and does not warn about a per-process one. */
const TEST_SIGNING_KEY = 'arranger-mcp-test-request-state-signing-key';

const config = (requestStateSecret: string | undefined): ArrangerMcpConfig =>
	({ mcp: { requestStateSecret } }) as ArrangerMcpConfig;

/** Only the field the binding reads is populated; nothing else in the context reaches the codec. */
const context = (method = 'tools/call'): ServerContext => ({ mcpReq: { method } }) as unknown as ServerContext;

const approvedQuery: ApprovedQuery = {
	endpoint: '/graphql',
	query: 'query ArrangerMcpExecuteQuery($filters: JSON) {\n\tparticipant {\n\t\thits {\n\t\t\ttotal\n\t\t}\n\t}\n}',
	variables: { filters: { op: 'and', content: [] } },
};

suite('digestApprovedQuery', () => {
	test('is stable for the same query', () => {
		assert.equal(digestApprovedQuery(approvedQuery), digestApprovedQuery({ ...approvedQuery }));
	});

	// Each part is covered because each part changes what runs: the document and its variables decide
	// the query, and the endpoint decides which catalogue it runs against.
	test('changes when the document changes', () => {
		const altered = { ...approvedQuery, query: approvedQuery.query.replace('total', 'total\n\t\t\tedges') };

		assert.notEqual(digestApprovedQuery(approvedQuery), digestApprovedQuery(altered));
	});

	test('changes when the variables change', () => {
		const altered = { ...approvedQuery, variables: { filters: { op: 'or', content: [] } } };

		assert.notEqual(digestApprovedQuery(approvedQuery), digestApprovedQuery(altered));
	});

	test('changes when the endpoint changes', () => {
		const altered = { ...approvedQuery, endpoint: '/files/graphql' };

		assert.notEqual(digestApprovedQuery(approvedQuery), digestApprovedQuery(altered));
	});
});

suite('createConfirmationCodec', () => {
	test('verifies back the digest it sealed', async () => {
		const codec = createConfirmationCodec(config(TEST_SIGNING_KEY));
		const digest = digestApprovedQuery(approvedQuery);

		const state = await codec.mint({ digest }, context());

		assert.deepEqual(await codec.verify(state, context()), { digest });
	});

	// The whole reason the digest is worth comparing: without a signature a caller could simply state
	// the digest of whatever query it wanted to run.
	test('refuses a state whose signature does not cover it', async () => {
		const codec = createConfirmationCodec(config(TEST_SIGNING_KEY));
		const state = await codec.mint({ digest: 'approved' }, context());

		const [prefix, body] = state.split('.');
		const forgedBody = Buffer.from(JSON.stringify({ p: { digest: 'substituted' }, exp: 2 ** 40 })).toString(
			'base64url',
		);
		const forged = `${prefix}.${forgedBody}.${state.slice(state.lastIndexOf('.') + 1)}`;

		assert.notEqual(body, forgedBody);
		await assert.rejects(codec.verify(forged, context()), /mac/);
	});

	test('refuses a state minted for a different method', async () => {
		const codec = createConfirmationCodec(config(TEST_SIGNING_KEY));
		const state = await codec.mint({ digest: 'approved' }, context('tools/call'));

		await assert.rejects(codec.verify(state, context('prompts/get')), /bind/);
	});

	test('refuses a value that was never minted', async () => {
		const codec = createConfirmationCodec(config(TEST_SIGNING_KEY));

		await assert.rejects(codec.verify('not-a-request-state', context()), /malformed/);
	});

	// Pins the shape of the mistake the wiring is arranged to avoid: `createMcpServer` runs per HTTP
	// request and a confirmation spans two of them, so a codec built there would be a different codec
	// on each round. With no secret configured, which is the local development path, that is not a
	// degraded flow but a broken one.
	test('does not share a per-process key with another codec', async () => {
		const state = await createConfirmationCodec(config(undefined)).mint({ digest: 'approved' }, context());

		await assert.rejects(createConfirmationCodec(config(undefined)).verify(state, context()), /mac/);
	});

	test('shares a configured secret with another codec', async () => {
		const state = await createConfirmationCodec(config(TEST_SIGNING_KEY)).mint({ digest: 'approved' }, context());

		assert.deepEqual(await createConfirmationCodec(config(TEST_SIGNING_KEY)).verify(state, context()), {
			digest: 'approved',
		});
	});
});
