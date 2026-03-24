import assert from 'node:assert';
import { test } from 'node:test';

export default ({ api }) => {
	test("1.should register a '/ping' endpoint", async () => {
		const { statusText } = await api
			.get({
				endpoint: '/ping',
			})
			.catch((err) => {
				console.log('spinupActive/ping error', err.message);
			});

		assert.equal(statusText, 'OK');
	});

	test("2.should register a '/graphql' endpoint", async () => {
		const { statusText } = await api
			.post({
				body: {
					query: `{ __schema { queryType { name } } }`,
				},
			})
			.catch((err) => {
				console.log('spinupActive/graphql error', err.message);
			});

		assert.equal(statusText, 'OK');
	});

	test("3.should register an '/introspection' endpoint", async () => {
		const { data, statusText } = await api
			.get({
				endpoint: '/introspection',
			})
			.catch((err) => {
				console.log('spinupActive/introspection error', err.message);
			});

		assert.equal(statusText, 'OK');
		assert.equal(data.mode, 'single');
		assert.equal(data.catalogCount, 1);
		assert.equal(data.sqonSchemaPath, '/introspection/sqon');
	});

	test("4.should register an '/introspection/sqon' endpoint", async () => {
		const { data, statusText } = await api
			.get({
				endpoint: '/introspection/sqon',
			})
			.catch((err) => {
				console.log('spinupActive/introspection/sqon error', err.message);
			});

		assert.equal(statusText, 'OK');
		assert.equal(typeof data.version, 'string');
		assert.equal(data.title, 'Serialized Query Object Notation');
	});

	test("5.should register the single-catalog '/introspection/fields' alias", async () => {
		const { data, statusText } = await api
			.get({
				endpoint: '/introspection/fields',
			})
			.catch((err) => {
				console.log('spinupActive/introspection/fields error', err.message);
			});

		assert.equal(statusText, 'OK');
		assert.equal(typeof data.catalogId, 'string');
		assert.equal(typeof data.documentType, 'string');
		assert.equal(typeof data.generatedAt, 'string');
		assert.ok(data.fields);
	});

	// TODO: add /download checks
};
