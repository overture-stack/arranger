import assert from 'node:assert';
import { suite, test } from 'node:test';

import express from 'express';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import request from 'supertest';

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

const buildApp = async ({ disablePlayground }: { disablePlayground: boolean }) => {
	const arrangerRouter = await createEndpoint({
		disablePlayground,
		enableDebug: false,
		schema,
	});

	return express().use(arrangerRouter);
};

suite('disablePlayground', () => {
	test('1.serves the landing page when playground is enabled', async () => {
		const response = await request(await buildApp({ disablePlayground: false }))
			.get('/graphql')
			.set('Accept', 'text/html');

		assert.equal(response.status, 200);
		assert.match(response.text, /apollo server landing page|welcome to apollo server/i);
	});

	test('2.does not serve the landing page when playground is disabled', async () => {
		const response = await request(await buildApp({ disablePlayground: true }))
			.get('/graphql')
			.set('Accept', 'text/html');

		assert.equal(response.status, 400);
		assert.match(response.text, /GET query missing/i);
	});
});
