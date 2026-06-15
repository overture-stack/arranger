import assert from 'node:assert';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/sdk/client';

export type ResourceEnv = {
	getClient: () => Client;
	configuredCatalogues: string[];
	expectedDocumentTypes: Record<string, string>;
	expectedFieldsByCatalogue: Record<string, string[]>;
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

export default ({ getClient, configuredCatalogues, expectedDocumentTypes, expectedFieldsByCatalogue }: ResourceEnv) => {
	test('1.reads arranger://introspection/server', async () => {
		const data = await readJsonResource(getClient(), 'arranger://introspection/server');

		assert.equal(data.mode, 'multiple');
		assert.equal(data.catalogCount, configuredCatalogues.length);
		assert.equal(data.sqonSchemaPath, '/introspection/sqon');

		for (const catalogueId of configuredCatalogues) {
			const catalogue = data.catalogs[catalogueId];
			assert.ok(catalogue, `expected catalogue '${catalogueId}' in server introspection`);
			assert.equal(catalogue.documentType, expectedDocumentTypes[catalogueId]);
			assert.equal(catalogue.paths.graphql, `/${catalogueId}/graphql`);
			assert.equal(catalogue.paths.introspection, `/introspection/${catalogueId}`);
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

	test('3.lists catalogue field resources via the resource template', async () => {
		const { resourceTemplates } = await getClient().listResourceTemplates();
		const template = resourceTemplates.find(
			(t) => t.uriTemplate === 'arranger://introspection/catalog/{catalogueId}',
		);
		assert.ok(template, 'expected catalogue-fields resource template to be registered');
	});

	test('4.reads arranger://introspection/catalog/{catalogueId} for each configured catalogue', async () => {
		for (const catalogueId of configuredCatalogues) {
			const data = await readJsonResource(getClient(), `arranger://introspection/catalog/${catalogueId}`);

			assert.equal(data.catalogId, catalogueId);
			assert.equal(data.documentType, expectedDocumentTypes[catalogueId]);
			assert.equal(typeof data.generatedAt, 'string');
			assert.ok(data.fields, 'expected fields object on catalogue introspection');

			const fieldNames = Object.keys(data.fields).sort();
			const expectedFieldNames = [...expectedFieldsByCatalogue[catalogueId]].sort();
			assert.deepEqual(fieldNames, expectedFieldNames);

			for (const fieldName of expectedFieldNames) {
				const field = data.fields[fieldName];
				assert.equal(typeof field.displayName, 'string');
				assert.equal(typeof field.type, 'string');
			}
		}
	});
};
