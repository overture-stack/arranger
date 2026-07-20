import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { suite, test } from 'node:test';

import axios from 'axios';
import express from 'express';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

import { createEndpoint } from '#graphqlRoutes.js';

const schema = new GraphQLSchema({
	query: new GraphQLObjectType({
		fields: {
			health: {
				resolve: () => 'ok',
				type: GraphQLString,
			},
		},
		name: 'Query',
	}),
});

const HEALTH_QUERY = '{ health }';

const startServer = async ({ enableGraphQLBatching }: { enableGraphQLBatching?: boolean } = {}) => {
	const app = express();
	const arrangerRouter = await createEndpoint({
		disablePlayground: true,
		enableDebug: false,
		enableGraphQLBatching,
		schema,
	});

	app.use(arrangerRouter);

	return new Promise<{ close: () => Promise<void>; url: string }>((resolve) => {
		const server = app.listen(0, () => {
			const { port } = server.address() as AddressInfo;

			resolve({
				close: () =>
					new Promise<void>((closeResolve, closeReject) => {
						server.close((err) => {
							if (err) {
								closeReject(err);
								return;
							}

							closeResolve();
						});
					}),
				url: `http://127.0.0.1:${port}/graphql`,
			});
		});
	});
};

suite('enableGraphQLBatching', () => {
	test('rejects an array of batched operations with a 400 when enableGraphQLBatching is left unset', async (t) => {
		const server = await startServer();
		t.after(server.close);

		const response = await axios.post(
			server.url,
			[{ query: HEALTH_QUERY }, { query: HEALTH_QUERY }],
			{ validateStatus: () => true },
		);

		assert.equal(response.status, 400);
		assert.ok(response.data?.errors?.some((e: { message: string }) => /batch/i.test(e.message)));
	});

	test('rejects an array of batched operations with a 400 when enableGraphQLBatching is false', async (t) => {
		const server = await startServer({ enableGraphQLBatching: false });
		t.after(server.close);

		const response = await axios.post(
			server.url,
			[{ query: HEALTH_QUERY }, { query: HEALTH_QUERY }],
			{ validateStatus: () => true },
		);

		assert.equal(response.status, 400);
		assert.ok(response.data?.errors?.some((e: { message: string }) => /batch/i.test(e.message)));
	});

	test('processes an array of batched operations when enableGraphQLBatching is true', async (t) => {
		const server = await startServer({ enableGraphQLBatching: true });
		t.after(server.close);

		const response = await axios.post(
			server.url,
			[{ query: HEALTH_QUERY }, { query: HEALTH_QUERY }],
			{ validateStatus: () => true },
		);

		assert.equal(response.status, 200);
		assert.ok(Array.isArray(response.data));
		assert.equal(response.data.length, 2);
		assert.ok(response.data.every((result: { data?: { health?: string } }) => result.data?.health === 'ok'));
	});

	test('still processes a single (non-batched) operation when enableGraphQLBatching is left unset', async (t) => {
		const server = await startServer();
		t.after(server.close);

		const response = await axios.post(server.url, { query: HEALTH_QUERY }, { validateStatus: () => true });

		assert.equal(response.status, 200);
		assert.equal(response.data?.data?.health, 'ok');
	});
});
