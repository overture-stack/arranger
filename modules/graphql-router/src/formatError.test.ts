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

const startServer = async () => {
	const app = express();
	const arrangerRouter = await createEndpoint({
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

suite('formatError', () => {
	test('strips "Did you mean" field-name suggestions from a misspelled-field error', async (t) => {
		const server = await startServer();
		t.after(server.close);

		const response = await axios.post(server.url, { query: '{ helth }' }, { validateStatus: () => true });

		assert.equal(response.status, 400);
		const message: string = response.data?.errors?.[0]?.message ?? '';
		assert.match(message, /Cannot query field/i);
		assert.doesNotMatch(message, /Did you mean/i);
	});

	test('leaves an unrelated validation error message unchanged', async (t) => {
		const server = await startServer();
		t.after(server.close);

		const response = await axios.post(server.url, { query: '{ health(unknownArg: 1) }' }, { validateStatus: () => true });

		assert.equal(response.status, 400);
		const message: string = response.data?.errors?.[0]?.message ?? '';
		assert.match(message, /unknownArg/i);
	});
});
