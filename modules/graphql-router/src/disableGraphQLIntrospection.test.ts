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

const INTROSPECTION_QUERY = '{ __schema { queryType { name } } }';

const buildApp = async ({ disableGraphQLIntrospection }: { disableGraphQLIntrospection: boolean }) => {
	const arrangerRouter = await createEndpoint({
		disableGraphQLIntrospection,
		disablePlayground: true,
		enableDebug: false,
		schema,
	});

	return express().use(arrangerRouter);
};

suite('disableGraphQLIntrospection', () => {
	test('allows introspection queries when disableGraphQLIntrospection is false', async () => {
		const response = await request(await buildApp({ disableGraphQLIntrospection: false }))
			.post('/graphql')
			.send({ query: INTROSPECTION_QUERY });

		assert.equal(response.status, 200);
		assert.ok(response.body?.data?.__schema?.queryType?.name);
	});

	test('rejects introspection queries when disableGraphQLIntrospection is true', async () => {
		const response = await request(await buildApp({ disableGraphQLIntrospection: true }))
			.post('/graphql')
			.send({ query: INTROSPECTION_QUERY });

		assert.equal(response.status, 400);
		assert.ok(response.body?.errors?.some((e: { message: string }) => /introspection/i.test(e.message)));
	});
});
