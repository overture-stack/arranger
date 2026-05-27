import assert from 'node:assert';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/sdk/client';

export type ResourceEnv = {
	getClient: () => Client;
	configuredCatalogues: string[];
	expectedDocumentTypes: Record<string, string>;
	expectedFieldsByCatalog: Record<string, string[]>;
};

const readJsonResource = async (mcpClient: Client, uri: string) => {
	const result = await mcpClient.readResource({ uri });
	assert.ok(result.contents.length > 0, `expected contents for resource ${uri}`);
	const [first] = result.contents;
	assert.equal(first.mimeType, 'application/json');
	assert.equal(first.uri, uri);
	assert.equal(typeof first.text, 'string');
	return JSON.parse(first.text as string);
};

export default ({ getClient, configuredCatalogues, expectedDocumentTypes, expectedFieldsByCatalog }: ResourceEnv) => {
	test('1.reads arranger://introspection/server', async () => {
		const data = await readJsonResource(getClient(), 'arranger://introspection/server');

		assert.equal(data.mode, 'multiple');
		assert.equal(data.catalogCount, configuredCatalogues.length);
		assert.equal(data.sqonSchemaPath, '/introspection/sqon');

		for (const catalogId of configuredCatalogues) {
			const catalog = data.catalogs[catalogId];
			assert.ok(catalog, `expected catalog '${catalogId}' in server introspection`);
			assert.equal(catalog.documentType, expectedDocumentTypes[catalogId]);
			assert.equal(catalog.paths.graphql, `/${catalogId}/graphql`);
			assert.equal(catalog.paths.introspection, `/introspection/${catalogId}`);
		}
	});

	test('2.reads arranger://introspection/sqon', async () => {
		const data = await readJsonResource(getClient(), 'arranger://introspection/sqon');

		assert.equal(typeof data.version, 'string');
		assert.equal(typeof data.title, 'string');
		assert.ok(data.schema, 'expected SQON schema body');
		assert.ok(data.operators, 'expected SQON operator metadata');
		assert.ok(Array.isArray(data.operators.combination));
		assert.ok(Array.isArray(data.operators.field));
	});

	test('3.lists catalog field resources via the resource template', async () => {
		const { resourceTemplates } = await getClient().listResourceTemplates();
		const template = resourceTemplates.find((t) => t.uriTemplate === 'arranger://introspection/catalog/{catalogId}');
		assert.ok(template, 'expected catalog-fields resource template to be registered');
	});

	test('4.reads arranger://introspection/catalog/{id} for each configured catalogue', async () => {
		for (const catalogId of configuredCatalogues) {
			const data = await readJsonResource(getClient(), `arranger://introspection/catalog/${catalogId}`);

			assert.equal(data.catalogId, catalogId);
			assert.equal(data.documentType, expectedDocumentTypes[catalogId]);
			assert.equal(typeof data.generatedAt, 'string');
			assert.ok(data.fields, 'expected fields object on catalog introspection');

			const fieldNames = Object.keys(data.fields).sort();
			const expectedFieldNames = [...expectedFieldsByCatalog[catalogId]].sort();
			assert.deepEqual(fieldNames, expectedFieldNames);

			for (const fieldName of expectedFieldNames) {
				const field = data.fields[fieldName];
				assert.equal(typeof field.displayName, 'string');
				assert.equal(typeof field.type, 'string');
				assert.ok(Array.isArray(field.validOperators));
				assert.ok(field.validOperators.length > 0);
			}
		}
	});
};
