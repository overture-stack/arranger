import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';
import { createUsherMiddleware } from '@overture-stack/usher-express-bridge';
import {
	canonicalRecordNarrowing,
	type Enforcement,
	type HeldResource,
	isCategoryName,
	type RecordKeyRegistration,
	type RecordNarrowingDescription,
	validateRegistration,
} from '@overture-stack/usher-types';
import dotenv from 'dotenv';
import express from 'express';

import arrangerRouter from '../../../modules/graphql-router/src/index.js';
import { type CatalogueIndex, createUsherAccessControl } from '../../../modules/usher-adapter/src/index.js';
import {
	createFakeBridge,
	createRecordingLogger,
	type FakeBridge,
} from '../../../modules/usher-adapter/src/testing/index.js';
import {
	type Catalogue,
	type CatalogueRecord,
	type Grants,
	isVisible,
	resourcesOf,
	UNMARKED_CATEGORY,
	visibleRecords,
} from '../harness/categoryChecker.js';
import {
	CATEGORY_ID_FIELD,
	CATEGORY_INDEX_MAPPING,
	CATEGORY_PRINCIPALS,
	CATEGORY_RECORDS,
	CATEGORY_REGISTRATION,
	CATEGORY_SERVED_RESOURCES,
	STUDY_A,
	STUDY_B,
} from '../harness/categoryFixture.js';
import {
	dropIndices,
	type Facets,
	type Hits,
	readersFor,
	searchClientFromEnv,
	seedIndex,
	serve,
	type Served,
	startRouter,
	type Target,
} from '../harness/parity.js';

/**
 * Usher's category model stated twice, held against itself: each principal's grants rendered by usher-types as the
 * access filter, compiled by the GraphQL router and run by the engine, against the category checker's reading of the
 * same grants over the same records.
 */

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await searchClientFromEnv();

const ENGINE = process.env.SEARCH_ENGINE || 'elasticsearch';

const DOCUMENT_TYPE = 'record';

const CATALOGUE: Catalogue = { mapping: CATEGORY_INDEX_MAPPING, registration: CATEGORY_REGISTRATION };

const RESOURCE_FIELD = CATEGORY_REGISTRATION.resourceFieldName;

type PrincipalName = keyof typeof CATEGORY_PRINCIPALS;

const isPrincipalName = (name: string): name is PrincipalName => Object.hasOwn(CATEGORY_PRINCIPALS, name);

const PRINCIPAL_NAMES = Object.keys(CATEGORY_PRINCIPALS).filter(isPrincipalName);

/** What each principal holds, as its tests are named. */
const PRINCIPAL_DESCRIPTIONS: Readonly<Record<PrincipalName, string>> = {
	communityOnStudyA: `a principal holding community and unmarked records on ${STUDY_A} alone`,
	controlledOnStudyA: `a principal holding controlled and unmarked records on ${STUDY_A}, and unmarked records alone on ${STUDY_B}`,
	controlledWithoutUnmarked: `a principal holding controlled on both studies and bulk on ${STUDY_B}, and neither study's unmarked records`,
	everything: 'a principal holding every category on both listed studies and on two unlisted ones',
	nobody: 'a principal holding nothing, whom the bridge denies,',
	unmarkedOnly: 'a principal holding the unmarked records alone of both studies',
	unmarkedWithBulkOnStudyB: `a principal holding unmarked records on both studies and bulk on ${STUDY_B}`,
};

const { facetsOf, hitsOf } = readersFor({
	documentType: DOCUMENT_TYPE,
	facets: [RESOURCE_FIELD],
	idField: CATEGORY_ID_FIELD,
});

/** The fixture's registration as Usher reads it, typed by the validation it passed. */
const usherRegistrationOf = (registration: unknown): RecordKeyRegistration => {
	const validation = validateRegistration(registration);

	switch (validation.success) {
		case true: {
			if (validation.registration.kind === 'record') {
				return validation.registration;
			}

			throw new Error(`Usher reads the category fixture's registration as a ${validation.registration.kind} key`);
		}
		case false: {
			throw new Error(
				`Usher refuses the category fixture's registration: ${JSON.stringify(validation.problems)}`,
			);
		}
	}
};

const USHER_REGISTRATION = usherRegistrationOf(CATEGORY_REGISTRATION);

/**
 * The narrowing description for a principal holding `grants`, or `undefined` when it holds no resource, which the
 * bridge answers with a deny rather than a narrowing. The known resources are the ones the audience serves together
 * with the registration's list; the held resources are the granted ones, every one of them served. Each holds its grants other than
 * `global.unmarked` as its categories, its unmarked records when it holds `global.unmarked`, and the registration's
 * own categories for it. The global categories are every one the registration defines, held or not.
 */
const descriptionFor = (grants: Grants): RecordNarrowingDescription | undefined => {
	const knownResources = [...new Set([...CATEGORY_SERVED_RESOURCES, ...(USHER_REGISTRATION.resources ?? [])])];
	const [firstHeld, ...otherHeld] = Object.entries(grants)
		.filter(([resource]) => knownResources.includes(resource))
		.map(
			([resource, held]): HeldResource => ({
				heldCategories: held.filter(isCategoryName).filter((name) => name !== UNMARKED_CATEGORY),
				resource,
				resourceCategories: USHER_REGISTRATION.categories.resource?.[resource] ?? {},
				unmarkedHeld: held.includes(UNMARKED_CATEGORY),
			}),
		);

	return firstHeld
		? {
				globalCategories: USHER_REGISTRATION.categories.global,
				heldResources: [firstHeld, ...otherHeld],
				knownResources: [...knownResources],
				resourceFieldName: USHER_REGISTRATION.resourceFieldName,
			}
		: undefined;
};

/**
 * The access filter a principal holding `grants` is served under: its narrowing rendered by usher-types, or, holding
 * no resource, a filter matching nothing on the resource field, standing for the bridge's deny, which the adapter
 * answers with a denial of the catalogue instead.
 */
const accessFilterFor = (grants: Grants): SqonNode => {
	const description = descriptionFor(grants);

	return description
		? canonicalRecordNarrowing(description)
		: SqonBuilder.matchNothing(USHER_REGISTRATION.resourceFieldName).toValue();
};

/** The bridge's result for a principal holding a known resource: its rendered narrowing. */
const narrowingFor = (principal: PrincipalName): Enforcement => {
	const description = descriptionFor(CATEGORY_PRINCIPALS[principal]);

	if (description) {
		return { kind: 'narrow', sqon: canonicalRecordNarrowing(description) };
	}

	throw new Error(`${principal} holds no listed study, so the bridge would deny it rather than narrow`);
};

const idOf = (record: CatalogueRecord): string => String(record[CATEGORY_ID_FIELD]);

const recordOf = (recordId: string): CatalogueRecord => {
	const record = CATEGORY_RECORDS.find((candidate) => idOf(candidate) === recordId);

	if (record) {
		return record;
	}

	throw new Error(`The category fixture holds no record "${recordId}"`);
};

const seed = (esIndex: string, records: readonly CatalogueRecord[]): Promise<void> =>
	seedIndex({
		esClient,
		esIndex,
		idField: CATEGORY_ID_FIELD,
		mappings: { mappings: { properties: structuredClone(CATEGORY_INDEX_MAPPING) } },
		records: records.map((record) => structuredClone(record)),
	});

/**
 * Asserts that `hits`, read over a page holding every record, serve exactly the records the checker shows
 * `principal`, naming each record served by one side alone.
 */
const assertServesExactly = ({
	hits,
	principal,
	shownIds,
}: {
	hits: Hits;
	principal: PrincipalName;
	shownIds: readonly string[];
}): void => {
	const servedByEngineAlone = hits.ids.filter((recordId) => !shownIds.includes(recordId)).toSorted();
	const servedByCheckerAlone = shownIds.filter((recordId) => !hits.ids.includes(recordId)).toSorted();

	assert.deepEqual(
		{ servedByCheckerAlone, servedByEngineAlone },
		{ servedByCheckerAlone: [], servedByEngineAlone: [] },
		`On ${ENGINE}, ${principal} is served ${JSON.stringify(servedByEngineAlone)} by the engine alone and ${JSON.stringify(servedByCheckerAlone)} by the checker alone`,
	);
	assert.equal(hits.total, shownIds.length, `On ${ENGINE}, the hits total for ${principal}`);
};

/** How many of `records` hold each study, a record holding several counted once under each. */
const studyCountsOf = (records: readonly CatalogueRecord[]): Record<string, number> => {
	const studies = records.flatMap((record) => resourcesOf({ catalogue: CATALOGUE, record }));

	return Object.fromEntries(
		[...new Set(studies)].map((study) => [study, studies.filter((each) => each === study).length]),
	);
};

const bucketCountsOf = (facets: Facets): Record<string, number> =>
	Object.fromEntries((facets[RESOURCE_FIELD] ?? []).map(({ doc_count, key }) => [key, doc_count]));

suite('each principal through the GraphQL router, against the category checker', { concurrency: false }, () => {
	const esIndex = 'testing-category-parity';
	const setsIndexOf = (principal: PrincipalName): string => `${esIndex}-sets-${principal.toLowerCase()}`;
	let routers: Readonly<Record<string, Served>> = {};

	before(async () => {
		await seed(esIndex, CATEGORY_RECORDS);
		routers = Object.fromEntries(
			await Promise.all(
				PRINCIPAL_NAMES.map(async (principal) => {
					const accessFilter = accessFilterFor(CATEGORY_PRINCIPALS[principal]);
					const served = await startRouter({
						documentType: DOCUMENT_TYPE,
						esClient,
						esIndex,
						getServerSideFilter: () => accessFilter,
						setsIndex: setsIndexOf(principal),
					});

					return [principal, served];
				}),
			),
		);
	});

	after(async () => {
		await Promise.all(Object.values(routers).map((served) => served.close()));
		await dropIndices(esClient, esIndex, ...PRINCIPAL_NAMES.map(setsIndexOf));
	});

	for (const principal of PRINCIPAL_NAMES) {
		test(`${PRINCIPAL_DESCRIPTIONS[principal]} sees exactly the records the checker shows it`, async () => {
			// Given the records the checker shows the principal, and how many of them hold each study. A terms
			// aggregation counts a record holding both studies in each study's bucket, so the checker's count for a
			// study is the number of shown records holding it, a record holding several counted once per study
			const shown = visibleRecords({
				catalogue: CATALOGUE,
				grants: CATEGORY_PRINCIPALS[principal],
				records: CATEGORY_RECORDS,
				servedResources: CATEGORY_SERVED_RESOURCES,
			});
			const target: Target = routers[principal];

			// When the principal's GraphQL router answers hits over a page holding every record, and the study
			// facet both filtering itself and not
			const [hits, facetsFiltered, facetsUnfiltered] = await Promise.all([
				hitsOf(target, null, { first: CATEGORY_RECORDS.length }),
				facetsOf(target, null, true),
				facetsOf(target, null, false),
			]);

			// Then the engine serves exactly the shown records, and counts each study's as the checker does
			assertServesExactly({ hits, principal, shownIds: shown.map(idOf) });
			const expectedCounts = studyCountsOf(shown);
			const counted = { filtered: bucketCountsOf(facetsFiltered), unfiltered: bucketCountsOf(facetsUnfiltered) };
			assert.deepEqual(
				counted,
				{ filtered: expectedCounts, unfiltered: expectedCounts },
				`On ${ENGINE}, ${principal}'s study counts are ${JSON.stringify(counted)} where the checker counts ${JSON.stringify(expectedCounts)}`,
			);
		});
	}

	suite('records holding several studies', () => {
		/** A principal, a record holding several studies, and whether the model serves that record to that principal. */
		type Decision = readonly [principal: PrincipalName, recordId: string, served: boolean];

		const RULES: readonly (readonly [rule: string, decisions: readonly Decision[]])[] = [
			[
				'withholds a record holding a study the principal does not hold',
				[
					['communityOnStudyA', 'ab-unmarked', false],
					['communityOnStudyA', 'ab-bulk', false],
				],
			],
			[
				'withholds a record holding both studies when either lacks a category the record carries there, and serves it when each holds them',
				[
					['controlledOnStudyA', 'ab-controlled', false],
					['controlledWithoutUnmarked', 'ab-controlled', true],
					['unmarkedOnly', 'ab-bulk', false],
					['unmarkedWithBulkOnStudyB', 'ab-bulk', true],
				],
			],
			[
				"withholds a record holding both studies when a study lacks its unmarked records and the record carries none of that study's categories",
				[
					['controlledWithoutUnmarked', 'ab-unmarked', false],
					['controlledWithoutUnmarked', 'ab-bulk', false],
					['unmarkedOnly', 'ab-unmarked', true],
				],
			],
			// The complement withholds only the resources the registration lists or the payload serves.
			[
				'serves a record holding a held study beside one neither served nor listed, deciding it by the held study alone',
				[
					['controlledWithoutUnmarked', 'a-and-unserved', false],
					['unmarkedOnly', 'a-and-unserved', true],
				],
			],
			[
				'withholds a record holding a held study beside one served but not held, listed or not',
				[
					['unmarkedOnly', 'a-and-unlisted', false],
					['everything', 'a-and-unlisted', true],
				],
			],
			[
				'serves a record holding only unlisted studies the audience serves to a principal granted them',
				[['everything', 'unlisted-pair', true]],
			],
		];

		for (const [rule, decisions] of RULES) {
			test(rule, async () => {
				// Given each principal and record, and whether the model serves that record to that principal
				// When the principal's GraphQL router answers hits, and the checker decides the record
				const decided = await Promise.all(
					decisions.map(async ([principal, recordId, served]) => {
						const { ids } = await hitsOf(routers[principal], null, { first: CATEGORY_RECORDS.length });
						const shown = isVisible({
							catalogue: CATALOGUE,
							grants: CATEGORY_PRINCIPALS[principal],
							record: recordOf(recordId),
							servedResources: CATEGORY_SERVED_RESOURCES,
						});

						return { checker: shown, engine: ids.includes(recordId), principal, recordId, served };
					}),
				);

				// Then the engine and the checker each decide every record as the rule does
				assert.deepEqual(
					decided.map(({ checker, engine, principal, recordId }) => ({
						checker,
						engine,
						principal,
						recordId,
					})),
					decided.map(({ principal, recordId, served }) => ({
						checker: served,
						engine: served,
						principal,
						recordId,
					})),
					`On ${ENGINE}, each side's decisions: ${JSON.stringify(decided)}`,
				);
			});
		}
	});
});

suite("the category fixture's records of one study each, through the Usher adapter", { concurrency: false }, () => {
	const esIndex = 'testing-category-parity-single-valued';
	const setsIndex = `${esIndex}-sets`;
	const CATALOGUE_ID = 'categories';
	const PRINCIPALS: readonly PrincipalName[] = [
		'communityOnStudyA',
		'controlledWithoutUnmarked',
		'everything',
		'unmarkedWithBulkOnStudyB',
	];
	const RECORDS = CATEGORY_RECORDS.filter((record) => resourcesOf({ catalogue: CATALOGUE, record }).length === 1);
	let bridge: FakeBridge;
	let served: Served;
	let verification: string;

	const targetFor = (principal: PrincipalName): Target => ({
		base: served.base,
		headers: { authorization: `Bearer ${principal}` },
	});

	before(async () => {
		await seed(esIndex, RECORDS);
		bridge = createFakeBridge({
			anonymous: {},
			principals: Object.fromEntries(
				PRINCIPALS.map((principal) => [
					principal,
					{ results: { [CATALOGUE_ID]: narrowingFor(principal) }, subject: `subject-${principal}` },
				]),
			),
		});
		const accessControl = createUsherAccessControl({
			bridge: bridge.core,
			catalogues: { [CATALOGUE_ID]: USHER_REGISTRATION },
			logger: createRecordingLogger().logger,
		});
		const { promise: handedOver, resolve } = Promise.withResolvers<CatalogueIndex>();
		const router = await arrangerRouter({
			configs: { documentType: DOCUMENT_TYPE, enableSets: true, esIndex, sets: { index: setsIndex } },
			esClient,
			getServerSideFilter: accessControl.filterFor(CATALOGUE_ID),
			onIndexMapping: (mapping, probe) => resolve({ mapping, probe }),
		});
		verification = await accessControl.verify({ [CATALOGUE_ID]: await handedOver }).then(
			() => 'passed',
			(error: unknown) => (error instanceof Error ? error.message : String(error)),
		);
		served = await serve(express().use([createUsherMiddleware(bridge.core), router]));
	});

	after(async () => {
		await served?.close();
		await dropIndices(esClient, esIndex, setsIndex);
		assert.deepEqual(bridge?.unexpected ?? [], [], 'a principal outside the fake bridge table was asked for');
	});

	test('passes the startup verification against its own index, and registers the catalogue', () => {
		assert.equal(verification, 'passed');
		assert.deepEqual(bridge.registered, [{ [CATALOGUE_ID]: USHER_REGISTRATION }]);
	});

	for (const principal of PRINCIPALS) {
		test(`${PRINCIPAL_DESCRIPTIONS[principal]} sees exactly the records of one study each the checker shows it`, async () => {
			// Given the records the checker shows the principal among those holding one study each
			const shownIds = visibleRecords({
				catalogue: CATALOGUE,
				grants: CATEGORY_PRINCIPALS[principal],
				records: RECORDS,
				servedResources: CATEGORY_SERVED_RESOURCES,
			}).map(idOf);

			// When the principal reads hits through the bridge's layer and the adapter
			const hits = await hitsOf(targetFor(principal), null, { first: RECORDS.length });

			// Then the engine serves exactly those records
			assertServesExactly({ hits, principal, shownIds });
		});
	}
});
