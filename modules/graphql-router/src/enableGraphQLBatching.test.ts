import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import express from 'express';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

import { createEndpoint } from '#graphqlRoutes.js';
import { withLoopbackServer } from '#loopbackServer.fixture.js';

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

const buildApp = async ({ enableGraphQLBatching }: { enableGraphQLBatching?: boolean } = {}) => {
	const arrangerRouter = await createEndpoint({
		disablePlayground: true,
		enableDebug: false,
		enableGraphQLBatching,
		schema,
	});

	return express().use(arrangerRouter);
};

suite('enableGraphQLBatching', () => {
	test('rejects an array of batched operations with a 400 when enableGraphQLBatching is left unset', async () => {
		const response = await withLoopbackServer(await buildApp(), (request) =>
			request.post('/graphql').send([{ query: HEALTH_QUERY }, { query: HEALTH_QUERY }]),
		);

		assert.equal(response.status, 400);
		assert.ok(response.body?.errors?.some((e: { message: string }) => /batch/i.test(e.message)));
	});

	test('rejects an array of batched operations with a 400 when enableGraphQLBatching is false', async () => {
		const response = await withLoopbackServer(await buildApp({ enableGraphQLBatching: false }), (request) =>
			request.post('/graphql').send([{ query: HEALTH_QUERY }, { query: HEALTH_QUERY }]),
		);

		assert.equal(response.status, 400);
		assert.ok(response.body?.errors?.some((e: { message: string }) => /batch/i.test(e.message)));
	});

	test('processes an array of batched operations when enableGraphQLBatching is true', async () => {
		const response = await withLoopbackServer(await buildApp({ enableGraphQLBatching: true }), (request) =>
			request.post('/graphql').send([{ query: HEALTH_QUERY }, { query: HEALTH_QUERY }]),
		);

		assert.equal(response.status, 200);
		assert.ok(Array.isArray(response.body));
		assert.equal(response.body.length, 2);
		assert.ok(response.body.every((result: { data?: { health?: string } }) => result.data?.health === 'ok'));
	});

	test('still processes a single (non-batched) operation when enableGraphQLBatching is left unset', async () => {
		const response = await withLoopbackServer(await buildApp(), (request) =>
			request.post('/graphql').send({ query: HEALTH_QUERY }),
		);

		assert.equal(response.status, 200);
		assert.equal(response.body?.data?.health, 'ok');
	});
});
