import assert from 'node:assert';
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

const startServer = async ({ disablePlayground }: { disablePlayground: boolean }) => {
	const app = express();
	const arrangerRouter = await createEndpoint({
		disablePlayground,
		enableDebug: false,
		schema,
	});

	app.use(arrangerRouter);

	return new Promise<{
		close: () => Promise<void>;
		url: string;
	}>((resolve) => {
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

suite('disablePlayground', () => {
	test('1.serves the landing page when playground is enabled', async (t) => {
		const server = await startServer({ disablePlayground: false });
		t.after(server.close);

		const response = await axios.get(server.url, {
			headers: {
				Accept: 'text/html',
			},
			validateStatus: () => true,
		});

		assert.equal(response.status, 200);
		assert.match(String(response.data), /apollo server landing page|welcome to apollo server/i);
	});

	test('2.does not serve the landing page when playground is disabled', async (t) => {
		const server = await startServer({ disablePlayground: true });
		t.after(server.close);

		const response = await axios.get(server.url, {
			headers: {
				Accept: 'text/html',
			},
			validateStatus: () => true,
		});

		assert.equal(response.status, 400);
		assert.match(String(response.data), /GET query missing/i);
	});
});
