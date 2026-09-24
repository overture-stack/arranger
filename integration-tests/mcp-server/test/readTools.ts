import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/client';

export type ToolEnv = {
	getClient: () => Client;
	configuredCatalogues: string[];
	expectedDocumentTypes: Record<string, string>;
	expectedFieldsByCatalogue: Record<string, string[]>;
};

const getTextContent = (result: Awaited<ReturnType<Client['callTool']>>): string => {
	// Not `notEqual(result.isError, true)`: under node:assert/strict that is notStrictEqual, which
	// lets a truthy-but-not-`true` isError through. Negating covers every truthy value.
	assert.ok(!result.isError, `tool call returned isError: ${JSON.stringify(result)}`);
	assert.ok(Array.isArray(result.content), 'expected tool result content to be an array');

	const [first] = result.content as { type: string; text?: string }[];
	assert.ok(first, 'expected at least one content entry in tool result');
	assert.equal(first.type, 'text');
	assert.equal(typeof first.text, 'string');
	return first.text as string;
};

export default ({ getClient, configuredCatalogues, expectedFieldsByCatalogue }: ToolEnv) => {
	test("1.'list_catalogues' returns the configured catalogue IDs", async () => {
		const result = await getClient().callTool({ name: 'list_catalogues' });
		const text = getTextContent(result);

		for (const catalogueId of configuredCatalogues) {
			assert.ok(text.includes(catalogueId), `expected '${catalogueId}' in list_catalogues output, got: ${text}`);
		}
	});

	test("2.'get_sqon_schema' returns a SQON cheat sheet plus the full payload in structuredContent", async () => {
		const result = await getClient().callTool({ name: 'get_sqon_schema' });

		// The text content is a human/LLM-oriented quick reference, not JSON. It must steer
		// callers toward the correct leaf shape (the "fieldName not field" pitfall).
		const text = getTextContent(result);
		assert.ok(text.includes('SQON'), `expected a SQON cheat sheet, got: ${text}`);
		assert.ok(text.includes('fieldName'), 'expected the cheat sheet to mention "fieldName"');

		// The full machine-readable schema and operator metadata move to structuredContent.
		const data = result.structuredContent as Record<string, unknown> | undefined;
		assert.ok(data, "expected 'get_sqon_schema' to return structuredContent");
		assert.equal(typeof data?.version, 'string');
		assert.equal(typeof data?.title, 'string');
		assert.ok(data?.schema);
		const operators = data?.operators as { combination?: unknown; field?: unknown } | undefined;
		assert.ok(operators);
		assert.ok(Array.isArray(operators?.combination));
		assert.ok(Array.isArray(operators?.field));
	});

	test("3.'get_catalogue_fields' returns field metadata for each configured catalogue", async () => {
		for (const catalogueId of configuredCatalogues) {
			const result = await getClient().callTool({
				name: 'get_catalogue_fields',
				arguments: { catalogueId },
			});

			const text = getTextContent(result);
			const data = JSON.parse(text);

			assert.equal(data.catalogId, catalogueId);
			assert.ok(data.fields, `expected fields object for '${catalogueId}'`);

			const fieldNames = Object.keys(data.fields).sort();
			const expected = [...expectedFieldsByCatalogue[catalogueId]].sort();
			assert.deepEqual(fieldNames, expected);

			// Tool also declares an outputSchema -> structured content should match the text content.
			const structured = (
				result as { structuredContent?: { catalogId: string; fields: Record<string, unknown> } }
			).structuredContent;
			assert.ok(structured, "expected 'get_catalogue_fields' to return structuredContent");
			assert.equal(structured?.catalogId, catalogueId);
			assert.deepEqual(Object.keys(structured?.fields ?? {}).sort(), expected);
		}
	});

	test("4.'get_catalogue_fields' returns an error for an unknown catalogue", async () => {
		const result = await getClient().callTool({
			name: 'get_catalogue_fields',
			arguments: { catalogueId: 'this-catalogue-does-not-exist' },
		});

		assert.equal(result.isError, true, 'expected tool call to surface the upstream Arranger 404 as an MCP error');

		// Asserting on the text as well: this test previously passed the argument as `catalogId`,
		// so it exercised schema validation of a missing required field rather than the upstream
		// 404 its name claims.
		const [first] = result.content as { type: string; text?: string }[];
		assert.match(first?.text ?? '', /this-catalogue-does-not-exist/);
	});

	test("5.'get_catalogue_fields' rejects a missing catalogueId argument", async () => {
		const result = await getClient().callTool({ name: 'get_catalogue_fields', arguments: {} });

		assert.equal(result.isError, true, 'expected a missing required argument to be rejected');
	});
};
