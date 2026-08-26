import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import type { ConfigsObject } from '@overture-stack/arranger-types/configs';

import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';
import { catalogueErrorCodes, classifyCatalogueFailureReason } from '#searchClient/index.js';

import arrangerRoutes, { createSchemasFromConfigs, FALLBACK_LABEL, isFallbackLabel } from './graphqlRoutes.js';

suite('isFallbackLabel', () => {
	test('returns true for the fallback label', () => {
		assert.equal(isFallbackLabel(FALLBACK_LABEL), true);
	});

	test('returns false for a real catalogue label', () => {
		assert.equal(isFallbackLabel('donor'), false);
	});

	test('returns false when no label is given', () => {
		assert.equal(isFallbackLabel(undefined), false);
	});
});

const fakeResponse = () => {
	const state: { body?: unknown; statusCode?: number } = {};
	return {
		send(payload: unknown) {
			state.body = payload;
			return this;
		},
		state,
		status(code: number) {
			state.statusCode = code;
			return this;
		},
	};
};

// Empty configs make getTypesWithMappings fail deterministically ("No configs available"),
// without needing a real ES client or schema, giving a reliable schema/endpoint-build failure.
const buildFailingArrangerRoutesArgs = (overrides: Record<string, unknown> = {}) => ({
	configs: {} as ConfigsObject<never>,
	enableDebug: false,
	esClient: {} as never,
	getServerSideFilter: getDefaultServerSideFilter,
	mappingFromIndex: {},
	...overrides,
});

suite('arrangerRoutes rethrowOnError', () => {
	test('rethrowOnError: false (default) returns a 500-responding handler instead of throwing', async () => {
		const handler = await arrangerRoutes(buildFailingArrangerRoutesArgs());
		const res = fakeResponse();

		assert.equal(typeof handler, 'function');
		(handler as (req: never, res: never, next: never) => unknown)(undefined, res as never, undefined);

		assert.equal(res.state.statusCode, 500);
	});

	test('rethrowOnError: true rejects instead of returning a handler, classifiable as schema_build_error', async () => {
		await assert.rejects(arrangerRoutes(buildFailingArrangerRoutesArgs({ rethrowOnError: true })), (error: unknown) => {
			assert.equal(classifyCatalogueFailureReason(error).code, catalogueErrorCodes.SCHEMA_BUILD_ERROR);
			return true;
		});
	});

	test('two fields colliding on the same sanitized GraphQL name reject naming both offenders, not just a generic graphql-js parse error', async () => {
		await assert.rejects(
			arrangerRoutes(
				buildFailingArrangerRoutesArgs({
					configs: { documentType: 'donor' } as ConfigsObject<never>,
					mappingFromIndex: {
						'ca19-9_level': { type: 'keyword' },
						ca19_9_level: { type: 'keyword' },
					},
					rethrowOnError: true,
				}),
			),
			(error: unknown) => {
				const classified = classifyCatalogueFailureReason(error);
				assert.equal(classified.code, catalogueErrorCodes.SCHEMA_BUILD_ERROR);
				assert.match(classified.message, /ca19-9_level/);
				assert.match(classified.message, /ca19_9_level/);
				return true;
			},
		);
	});
});

suite('field name sanitization', () => {
	test('a mapping with a hyphenated nested field name now builds a schema instead of failing', async () => {
		const result = await createSchemasFromConfigs({
			configs: { documentType: 'donor' } as ConfigsObject<never>,
			enableDebug: false,
			esClient: {} as never,
			getServerSideFilter: getDefaultServerSideFilter,
			mappingFromIndex: {
				biomarker: {
					type: 'nested',
					properties: { 'ca19-9_level': { type: 'keyword' } },
				},
			},
			setsIndex: 'test-sets',
		});

		assert.ok(result.schema);
		const typeNames = result.schema.toConfig().types.map((t) => t.name);
		assert.ok(typeNames.some((name) => name.endsWith('Biomarker')), `expected a "...Biomarker" type, got: ${typeNames}`);
	});
});
