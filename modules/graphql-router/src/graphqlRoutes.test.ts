import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import type { ConfigsObject } from '@overture-stack/arranger-types/configs';

import { catalogueErrorCodes, classifyCatalogueFailureReason } from '#searchClient/index.js';

import arrangerRoutes, { FALLBACK_LABEL, isFallbackLabel } from './graphqlRoutes.js';

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
	getServerSideFilter: (() => undefined) as never,
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

	test('a mapping with an invalid GraphQL field name rejects naming the offending field, not just a generic graphql-js parse error', async () => {
		await assert.rejects(
			arrangerRoutes(
				buildFailingArrangerRoutesArgs({
					configs: { documentType: 'donor' } as ConfigsObject<never>,
					mappingFromIndex: { 'ca19-9_level': { type: 'keyword' } },
					rethrowOnError: true,
				}),
			),
			(error: unknown) => {
				const classified = classifyCatalogueFailureReason(error);
				assert.equal(classified.code, catalogueErrorCodes.SCHEMA_BUILD_ERROR);
				assert.match(classified.message, /ca19-9_level/);
				return true;
			},
		);
	});
});
