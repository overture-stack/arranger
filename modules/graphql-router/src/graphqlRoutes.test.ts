import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import type { ConfigsObject } from '@overture-stack/arranger-types/configs';

import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';
import { restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';
import * as packageRoot from '#index.js';
import { catalogueErrorCodes, classifyCatalogueFailureReason } from '#searchClient/index.js';

import arrangerRoutes, { createSchemasFromConfigs, FALLBACK_LABEL, isFallbackLabel } from './graphqlRoutes.js';

/** Arguments every builder accepts and builds from, so a refusal can only come from the filter. */
const BUILDABLE_ARGUMENTS = {
	configs: { documentType: 'donor', esIndex: 'donor_index' } as ConfigsObject<never>,
	enableDebug: false,
	esClient: {} as never,
	mappingFromIndex: { donor_id: { type: 'keyword' }, study: { type: 'keyword' } },
};

const STUDY_A = restrictingFilter({ fieldName: 'study', values: ['A'] });

/** Values a builder cannot apply as a server-side filter: absent, not a function, or a function returning a promise. */
const UNUSABLE_FILTERS: [string, unknown][] = [
	['absent', undefined],
	['null', null],
	['false', false],
	['true', true],
	['zero', 0],
	['an empty string', ''],
	['a string', 'includeEverything'],
	['a plain object', {}],
	['an array holding a filter function', [STUDY_A]],
	['a SQON object', { content: { fieldName: 'study', value: ['A'] }, op: 'in' }],
	['an async function', async () => STUDY_A({})],
];

/** The descriptions of the cases whose build resolved instead of rejecting, whether a builder throws or rejects. */
const casesThatBuilt = async (cases: [string, () => Promise<unknown>][]): Promise<string[]> => {
	const outcomes = await Promise.all(
		cases.map(async ([description, build]) => ({
			built: await Promise.resolve()
				.then(build)
				.then(
					() => true,
					() => false,
				),
			description,
		})),
	);

	return outcomes.filter(({ built }) => built).map(({ description }) => description);
};

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
		await assert.rejects(
			arrangerRoutes(buildFailingArrangerRoutesArgs({ rethrowOnError: true })),
			(error: unknown) => {
				assert.equal(classifyCatalogueFailureReason(error).code, catalogueErrorCodes.SCHEMA_BUILD_ERROR);
				return true;
			},
		);
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
		const typeNames = result.schema.toConfig().types.map((type) => type.name);
		assert.ok(
			typeNames.some((name) => name.endsWith('Biomarker')),
			`expected a "...Biomarker" type, got: ${typeNames}`,
		);
	});
});

suite('schema builders require a non-async getServerSideFilter at build', () => {
	test('getGraphQLRoutes builds with a non-async function', async () => {
		// Given buildable arguments and a restricting function
		// When the routes are built
		const routes = await arrangerRoutes({ ...BUILDABLE_ARGUMENTS, getServerSideFilter: STUDY_A });

		// Then the result is the route stack, not the handler that answers every request with a 500
		assert.ok(Array.isArray(routes));
	});

	test('getGraphQLRoutes refuses at build, even with rethrowOnError false, rather than answering 500 later', async () => {
		// Given each unusable value, with rethrowOnError false, true, and left at its default
		const cases = UNUSABLE_FILTERS.flatMap(([description, unusableFilter]) =>
			[{ rethrowOnError: false }, { rethrowOnError: true }, {}].map(
				(rethrowSetting): [string, () => Promise<unknown>] => [
					`${description} with ${JSON.stringify(rethrowSetting)}`,
					() =>
						arrangerRoutes({
							...BUILDABLE_ARGUMENTS,
							getServerSideFilter: unusableFilter as never,
							...rethrowSetting,
						}),
				],
			),
		);

		// When the routes are built for each
		const built = await casesThatBuilt(cases);

		// Then every build itself rejects
		assert.deepEqual(built, []);
	});

	test('createSchemasFromConfigs builds with a non-async function', async () => {
		// Given buildable arguments and a restricting function
		// When the schemas are built
		const result = await createSchemasFromConfigs({
			...BUILDABLE_ARGUMENTS,
			getServerSideFilter: STUDY_A,
			setsIndex: 'test-sets',
		});

		// Then a schema comes back
		assert.ok(result.schema);
	});

	test('createSchemasFromConfigs refuses at build for an absent or unusable filter', async () => {
		// Given each unusable value
		const cases = UNUSABLE_FILTERS.map(([description, unusableFilter]): [string, () => Promise<unknown>] => [
			description,
			() =>
				createSchemasFromConfigs({
					...BUILDABLE_ARGUMENTS,
					getServerSideFilter: unusableFilter as never,
					setsIndex: 'test-sets',
				}),
		]);

		// When the schemas are built for each
		const built = await casesThatBuilt(cases);

		// Then every build rejects
		assert.deepEqual(built, []);
	});

	test('both builders accept includeEverything', async () => {
		// Given the package root's includeEverything
		assert.equal(typeof packageRoot.includeEverything, 'function');

		// When each builder is given it
		const routes = await arrangerRoutes({
			...BUILDABLE_ARGUMENTS,
			getServerSideFilter: packageRoot.includeEverything,
		});
		const schemas = await createSchemasFromConfigs({
			...BUILDABLE_ARGUMENTS,
			getServerSideFilter: packageRoot.includeEverything,
			setsIndex: 'test-sets',
		});

		// Then both build
		assert.ok(Array.isArray(routes));
		assert.ok(schemas.schema);
	});
});
