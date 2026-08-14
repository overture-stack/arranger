import assert from 'node:assert/strict';
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

const buildApp = async () => {
	const arrangerRouter = await createEndpoint({
		disablePlayground: true,
		enableDebug: false,
		schema,
	});

	return express().use(arrangerRouter);
};

suite('formatError', () => {
	test('strips "Did you mean" field-name suggestions from a misspelled-field error', async () => {
		const response = await request(await buildApp()).post('/graphql').send({ query: '{ helth }' });

		assert.equal(response.status, 400);
		const message: string = response.body?.errors?.[0]?.message ?? '';
		assert.match(message, /Cannot query field/i);
		assert.doesNotMatch(message, /Did you mean/i);
	});

	test('leaves an unrelated validation error message unchanged', async () => {
		const response = await request(await buildApp())
			.post('/graphql')
			.send({ query: '{ health(unknownArg: 1) }' });

		assert.equal(response.status, 400);
		const message: string = response.body?.errors?.[0]?.message ?? '';
		assert.match(message, /unknownArg/i);
	});
});
