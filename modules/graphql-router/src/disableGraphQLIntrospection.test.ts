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

const INTROSPECTION_QUERY = '{ __schema { queryType { name } } }';

const startServer = async ({ disableGraphQLIntrospection }: { disableGraphQLIntrospection: boolean }) => {
	const app = express();
	const arrangerRouter = await createEndpoint({
		disableGraphQLIntrospection,
		disablePlayground: true,
		enableDebug: false,
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

suite('disableGraphQLIntrospection', () => {
	test('allows introspection queries when disableGraphQLIntrospection is false', async (t) => {
		const server = await startServer({ disableGraphQLIntrospection: false });
		t.after(server.close);

		const response = await axios.post(server.url, { query: INTROSPECTION_QUERY }, { validateStatus: () => true });

		assert.equal(response.status, 200);
		assert.ok(response.data?.data?.__schema?.queryType?.name);
	});

	test('rejects introspection queries when disableGraphQLIntrospection is true', async (t) => {
		const server = await startServer({ disableGraphQLIntrospection: true });
		t.after(server.close);

		const response = await axios.post(server.url, { query: INTROSPECTION_QUERY }, { validateStatus: () => true });

		assert.equal(response.status, 400);
		assert.ok(response.data?.errors?.some((e: { message: string }) => /introspection/i.test(e.message)));
	});
});
