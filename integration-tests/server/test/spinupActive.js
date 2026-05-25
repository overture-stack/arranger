import assert from 'node:assert';
import { test } from 'node:test';

export default ({ api, catalogs, mode = 'single' }) => {
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

	test("3.should register an '/introspection' endpoint", async () => {
		const { data, statusText } = await api
			.get({
				endpoint: '/introspection',
			})
			.catch((err) => {
				console.log('spinupActive/introspection error', err.message);
			});

		assert.equal(statusText, 'OK');
		assert.equal(data.mode, mode);
		assert.equal(data.catalogCount, catalogs.length);
		assert.equal(data.sqonSchemaPath, '/introspection/sqon');

		if (mode === 'single') {
			const [singleCatalog] = Object.values(data.catalogs);
			assert.ok(singleCatalog);
			assert.equal(singleCatalog.documentType, catalogs[0].documentType);
			assert.equal(singleCatalog.paths.graphql, catalogs[0].gqlPath);
			assert.equal(singleCatalog.paths.fields, '/introspection/fields');
		} else {
			catalogs.forEach(({ catalogId, documentType, gqlPath }) => {
				assert.equal(data.catalogs[catalogId].documentType, documentType);
				assert.equal(data.catalogs[catalogId].paths.graphql, gqlPath);
				assert.equal(data.catalogs[catalogId].paths.introspection, `/introspection/${catalogId}`);
			});
		}
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

	test('5.should register each GraphQL endpoint', async () => {
		for (const { gqlPath } of catalogs) {
			const { statusText } = await api
				.post({
					body: {
						query: `{ __schema { queryType { name } } }`,
					},
					endpoint: gqlPath,
				})
				.catch((err) => {
					console.log('spinupActive/graphql error', err.message);
				});

			assert.equal(statusText, 'OK');
		}
	});

	test("6.should register the single-catalog '/introspection/fields' alias", async () => {
		if (mode !== 'single') {
			return;
		}

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

	test('7.should register catalog-specific introspection in multiple mode', async () => {
		if (mode !== 'multiple') {
			return;
		}

		for (const { catalogId, documentType } of catalogs) {
			const { data, statusText } = await api
				.get({
					endpoint: `/introspection/${catalogId}`,
				})
				.catch((err) => {
					console.log('spinupActive/introspection/catalog error', err.message);
				});

			assert.equal(statusText, 'OK');
			assert.equal(data.catalogId, catalogId);
			assert.equal(data.documentType, documentType);
			assert.equal(typeof data.generatedAt, 'string');
			assert.ok(data.fields);
		}
	});

	// TODO: add /download checks
};
