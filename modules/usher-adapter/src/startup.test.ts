import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { suite, test } from 'node:test';

import type { IndexProbe } from '@overture-stack/arranger-graphql-router';
import type { SqonNode } from '@overture-stack/sqon';
import {
	type BridgeConfiguration,
	type BridgeCore,
	type BridgeLogger,
	createBridgeCore,
	type KeyRegistration,
	type RecordKeyRegistration,
} from '@overture-stack/usher-express-bridge';
import { attachAccess, REGISTRATION_RULES, UsherContractError } from '@overture-stack/usher-types';

import { EVENTS, isConfigurationRefusal } from './fixtures/arrangerNames.js';
import {
	ABSENT_CATEGORIES_REGISTRATION,
	CATEGORY_CONDITIONS,
	CATEGORY_FIELD,
	categoryCondition,
	CONTROLLED_ONLY_REGISTRATION,
	EMPTY_LIST_REGISTRATION,
	INDEX_MAPPING,
	OPEN_REGISTRATION,
	RECORDS_REGISTRATION,
	RESOURCE_CATEGORY_REGISTRATION,
	RESOURCE_FIELD,
} from './fixtures/catalogue.js';
import { createFakeBridge } from './fixtures/fakeBridge.js';
import { createRecordingLogger } from './fixtures/recordingLogger.js';
import { accessOf, ANONYMOUS, CONTROLLED_ONLY_ANONYMOUS, ROWS } from './fixtures/results.js';
import { createStubProbe } from './fixtures/stubProbe.js';
import { type CatalogueIndex, createBridgeLogger, createUsherAccessControl } from './index.js';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64url');

const bridgeConfiguration = (
	logger: BridgeLogger,
	overrides: Partial<BridgeConfiguration> = {},
): BridgeConfiguration => ({
	audience: `arranger-${randomUUID()}`,
	controllerUrl: 'https://usher.example.org/',
	eventSource: 'https://search.example.org/usher-bridge',
	issuer: 'https://usher.example.org',
	key: TEST_KEY,
	logger,
	payloadVersions: [1],
	...overrides,
});

/** A real bridge, never started, so it needs no controller: its `register` checks registrations as Usher does. */
const unstartedBridge = (logger: BridgeLogger): BridgeCore => createBridgeCore(bridgeConfiguration(logger));

const fakeTable = { anonymous: { records: ROWS.anonymousBaselineOn.result }, principals: {} };

/** The adapter over a fake bridge, with its catalogues configured as given, and the lines it logs. */
const adapterOver = (catalogues: Readonly<Record<string, KeyRegistration>>) => {
	const bridge = createFakeBridge(fakeTable);
	const { lines, logger } = createRecordingLogger();
	const accessControl = createUsherAccessControl({ bridge: bridge.core, catalogues, logger });
	return { accessControl, bridge, lines };
};

/** A catalogue's index as its GraphQL router hands it over: its mapping, and a probe answering by default. */
const indexOf = (
	mapping: Readonly<Record<string, unknown>> = INDEX_MAPPING,
	probe: IndexProbe = createStubProbe().probe,
): CatalogueIndex => ({ mapping, probe });

/** What a refusal says, message and problems alike, so a test can ask whether it names something. */
const describeRefusal = (error: unknown): string =>
	error instanceof Error
		? JSON.stringify({ message: error.message, problems: (error as { problems?: unknown }).problems ?? null })
		: String(error);

/** The refusal `verify` rejects with, failing the test when it resolves instead. */
const refusalOf = async (verification: Promise<void>): Promise<string> => {
	const refusal = await verification.then(
		() => undefined,
		(error: unknown) => describeRefusal(error),
	);
	assert.ok(refusal !== undefined, 'verification resolved, though a refusal was expected');
	return refusal;
};

/** Asserts that `text` names each of `names` and holds none of `forbidden`. */
const assertNames = (text: string, names: readonly string[], forbidden: readonly string[] = []): void => {
	assert.deepEqual(
		names.filter((name) => !text.includes(name)),
		[],
		`not named in ${text}`,
	);
	assert.deepEqual(
		forbidden.filter((value) => text.includes(value)),
		[],
		`held in ${text}`,
	);
};

/**
 * Catalogue keys no refusal's prose would contain by chance, so a check that a refusal names one
 * cannot pass on its wording alone.
 */
const NAMED_CATALOGUE = 'catalogue-k7';
const OTHER_CATALOGUE = 'catalogue-k8';
const UNCONFIGURED_CATALOGUE = 'missing-catalogue-k9';

/** A value a condition tests, and a value an engine's explanation quotes, which no reason or line may hold. */
const CONDITION_VALUE = 'value-sentinel-q4';
const ENGINE_VALUE = 'engine-sentinel-z8';

/** A catalogue whose one global category tests `CONDITION_VALUE`, so a check can ask whether a reason names a value. */
const SENTINEL_REGISTRATION: RecordKeyRegistration = {
	categories: { global: { 'global.controlled': categoryCondition(CONDITION_VALUE) } },
	kind: 'record',
	resourceFieldName: RESOURCE_FIELD,
	resources: ['HEART_STUDY'],
};

/** The condition a resource's own category is counted under: its records within that resource alone. */
const withinResource = (resourceId: string, condition: SqonNode): SqonNode => ({
	content: [{ content: { fieldName: RESOURCE_FIELD, value: [resourceId] }, op: 'in' }, condition],
	op: 'and',
});

/** A promise a test settles itself, so a check can be held unanswered. */
const deferred = <Value>(): { promise: Promise<Value>; resolve: (value: Value) => void } => {
	const settlers: { resolve?: (value: Value) => void } = {};
	const promise = new Promise<Value>((resolve) => {
		settlers.resolve = resolve;
	});
	return { promise, resolve: (value) => settlers.resolve?.(value) };
};

const REEF_CATEGORY = 'resource.reef-elders';
const REEF_CONDITION = categoryCondition('reef-elders');

suite('the adapter at startup', () => {
	test('refuses a catalogue the adapter has no configuration for, naming it', () => {
		// Given an adapter configured for one catalogue
		const { accessControl } = adapterOver({ [NAMED_CATALOGUE]: RECORDS_REGISTRATION });

		// When the host asks for a callback for another, Then startup fails naming it
		assert.throws(
			() => accessControl.filterFor(UNCONFIGURED_CATALOGUE),
			(error: unknown) => describeRefusal(error).includes(UNCONFIGURED_CATALOGUE),
		);
	});

	suite('checking each registration against the registration format', () => {
		for (const [description, registration, rule] of [
			[
				'an empty resource field name',
				{ ...RECORDS_REGISTRATION, resourceFieldName: '' },
				REGISTRATION_RULES.resourceFieldName,
			],
			[
				'a category field and mapped values in place of conditions',
				{ ...RECORDS_REGISTRATION, categoryFieldName: CATEGORY_FIELD, categoryValues: {} },
				REGISTRATION_RULES.members,
			],
			[
				'a category both declared absent and defined',
				{ ...RECORDS_REGISTRATION, absentCategories: ['global.controlled'] },
				REGISTRATION_RULES.absentNotDefined,
			],
			[
				'a condition reading the resource field',
				{
					...RECORDS_REGISTRATION,
					categories: { global: { 'global.controlled': categoryCondition('HEART_STUDY') } },
					resourceFieldName: CATEGORY_FIELD,
				},
				REGISTRATION_RULES.resourceFieldUnread,
			],
			[
				'a resource holding the set_id: marker',
				{ ...RECORDS_REGISTRATION, resources: ['set_id:HEART_STUDY'] },
				REGISTRATION_RULES.resources,
			],
		] as const) {
			test(`refuses a registration with ${description}, naming the catalogue and the rule, before its mapping or index is read`, async () => {
				// Given a registration the format refuses, whose mapping is missing every field as well
				const { accessControl, bridge } = adapterOver({
					[NAMED_CATALOGUE]: registration as unknown as KeyRegistration,
				});
				const { calls, probe } = createStubProbe();

				// When the adapter verifies it
				const refusal = await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf({}, probe) }));

				// Then the refusal names the catalogue and the format's rule, and none of the mapping's
				// reasons, the index was asked nothing, and nothing was registered
				assertNames(refusal, [NAMED_CATALOGUE, rule], ['absent from its index mapping']);
				assert.deepEqual(calls, []);
				assert.deepEqual(bridge.registered, []);
			});
		}

		test('refuses a condition holding the * marker, naming the catalogue and the category', async () => {
			// Given a category whose condition holds a value read as a pattern
			const { accessControl, bridge } = adapterOver({
				[NAMED_CATALOGUE]: {
					...RECORDS_REGISTRATION,
					categories: { global: { 'global.controlled': categoryCondition('*') } },
				},
			});

			// When the adapter verifies it, Then the refusal names the catalogue and the category, and nothing is
			// registered
			assertNames(await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf() })), [
				NAMED_CATALOGUE,
				'global.controlled',
			]);
			assert.deepEqual(bridge.registered, []);
		});

		test("refuses a resource's own condition holding the * marker, naming the catalogue, the resource and the category", async () => {
			// Given a resource's own category whose condition holds a value read as a pattern
			const { accessControl, bridge } = adapterOver({
				[NAMED_CATALOGUE]: {
					...RESOURCE_CATEGORY_REGISTRATION,
					categories: {
						...RESOURCE_CATEGORY_REGISTRATION.categories,
						resource: { REEF_ARCHIVE: { [REEF_CATEGORY]: categoryCondition('*') } },
					},
				},
			});

			// When the adapter verifies it, Then the refusal names the catalogue, the resource and the category
			assertNames(await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf() })), [
				NAMED_CATALOGUE,
				'REEF_ARCHIVE',
				REEF_CATEGORY,
			]);
			assert.deepEqual(bridge.registered, []);
		});
	});

	suite('checking each catalogue against its index mapping', () => {
		for (const [description, mapping, field] of [
			['its resource field absent', { ...INDEX_MAPPING, study_id: undefined }, 'study_id'],
			[
				'a field a category condition reads absent',
				{ ...INDEX_MAPPING, data_category: undefined },
				'data_category',
			],
		] as const) {
			test(`refuses a catalogue whose mapping has ${description}, naming the catalogue and the field, before its index is asked anything`, async () => {
				// Given the catalogue's index mapping lacks a field its registration names
				const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: RECORDS_REGISTRATION });
				const fetched = Object.fromEntries(Object.entries(mapping).filter(([, value]) => value !== undefined));
				const { calls, probe } = createStubProbe();

				// When the adapter verifies it
				const refusal = await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf(fetched, probe) }));

				// Then startup fails naming both, the index was asked nothing, and nothing is registered
				assertNames(refusal, [NAMED_CATALOGUE, field]);
				assert.deepEqual(calls, []);
				assert.deepEqual(bridge.registered, []);
			});
		}

		for (const [description, catalogue, mapping, field] of [
			[
				'a text field, which an exact match cannot enforce on',
				RECORDS_REGISTRATION,
				{ ...INDEX_MAPPING, study_id: { type: 'text' } },
				'study_id',
			],
			[
				'a field inside a nested mapping, since the record is the unit of access',
				{ ...RECORDS_REGISTRATION, resourceFieldName: 'files.file_type' },
				INDEX_MAPPING,
				'files.file_type',
			],
		] as const) {
			test(`refuses to enforce on ${description}`, async () => {
				// Given a mapped field whose mapping shape the adapter cannot enforce on
				const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: catalogue });

				// When the adapter verifies it, Then startup fails naming the catalogue and the field, since
				// enforcing anyway would be guesswork
				assertNames(await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf(mapping) })), [
					NAMED_CATALOGUE,
					field,
				]);
				assert.deepEqual(bridge.registered, []);
			});
		}

		test('refuses an artifact key, which it does not serve, naming the catalogue', async () => {
			// Given a catalogue registering an artifact key
			const { accessControl, bridge } = adapterOver({
				[NAMED_CATALOGUE]: { kind: 'artifact', provenanceFieldName: 'study_id', resources: ['HEART_STUDY'] },
			});

			// When the adapter verifies it, Then startup fails naming the catalogue, and nothing is registered
			assertNames(await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf() })), [
				NAMED_CATALOGUE,
				'artifact',
			]);
			assert.deepEqual(bridge.registered, []);
		});
	});

	suite('checking each catalogue against what its index holds', () => {
		test('asks the index, once the registration and the mapping pass, about the resource field and every category condition', async () => {
			// Given a catalogue defining two global categories and one of REEF_ARCHIVE's own
			const { accessControl } = adapterOver({ [NAMED_CATALOGUE]: RESOURCE_CATEGORY_REGISTRATION });
			const { calls, probe } = createStubProbe();

			// When the adapter verifies it
			await accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) });

			// Then the index was asked about the resource field once, and validated and counted every
			// condition, a resource's own counted within that resource
			const sortedCalls = (check: string): string[] =>
				calls
					.filter((call) => call.check === check)
					.map(({ argument }) => JSON.stringify(argument))
					.toSorted();
			assert.deepEqual(sortedCalls('countRecordsHoldingSeveralValues'), [JSON.stringify(RESOURCE_FIELD)]);
			assert.deepEqual(
				sortedCalls('validate'),
				[
					CATEGORY_CONDITIONS['global.community-governed'],
					CATEGORY_CONDITIONS['global.controlled'],
					REEF_CONDITION,
				]
					.map((condition) => JSON.stringify(condition))
					.toSorted(),
			);
			assert.deepEqual(
				sortedCalls('countMatching'),
				[
					CATEGORY_CONDITIONS['global.community-governed'],
					CATEGORY_CONDITIONS['global.controlled'],
					withinResource('REEF_ARCHIVE', REEF_CONDITION),
				]
					.map((condition) => JSON.stringify(condition))
					.toSorted(),
			);
		});

		test('asks the index nothing about a category declared absent, which holds no condition', async () => {
			// Given a catalogue defining no category and declaring both absent
			const { accessControl, bridge, lines } = adapterOver({ records: ABSENT_CATEGORIES_REGISTRATION });
			const { calls, probe } = createStubProbe();

			// When the adapter verifies it
			await accessControl.verify({ records: indexOf(INDEX_MAPPING, probe) });

			// Then only the resource field was asked about, nothing was warned of, and the catalogue is registered
			assert.deepEqual(
				calls.map(({ check }) => check),
				['countRecordsHoldingSeveralValues'],
			);
			assert.deepEqual(lines, []);
			assert.deepEqual(bridge.registered, [{ records: ABSENT_CATEGORIES_REGISTRATION }]);
		});

		test('asks the index nothing about an open catalogue', async () => {
			const { accessControl, bridge } = adapterOver({ records: OPEN_REGISTRATION });
			const { calls, probe } = createStubProbe();

			await accessControl.verify({ records: indexOf(INDEX_MAPPING, probe) });

			assert.deepEqual(calls, []);
			assert.deepEqual(bridge.registered, [{ records: OPEN_REGISTRATION }]);
		});

		test('refuses a catalogue whose resource field holds several values in some record, naming the catalogue, the field and the count', async () => {
			// Given an index where three records hold more than one value in the resource field
			const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: RECORDS_REGISTRATION });
			const { probe } = createStubProbe({ countRecordsHoldingSeveralValues: async () => 3 });

			// When the adapter verifies it
			const refusal = await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) }));

			// Then startup fails naming the catalogue, the field and the count, and nothing is registered
			assertNames(refusal, [NAMED_CATALOGUE, RESOURCE_FIELD, '3 records']);
			assert.deepEqual(bridge.registered, []);
		});

		test('refuses a catalogue whose count of records holding several resource values could not run, saying so', async () => {
			// Given an engine refusing the check, as one refusing the script or failing a shard does
			const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: RECORDS_REGISTRATION });
			const { probe } = createStubProbe({
				countRecordsHoldingSeveralValues: async () => {
					throw new Error(`a shard failed on ${ENGINE_VALUE}`);
				},
			});

			// When the adapter verifies it
			const refusal = await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) }));

			// Then startup fails closed, naming the catalogue and the field and saying the check could not run,
			// with nothing of the engine's failure
			assertNames(refusal, [NAMED_CATALOGUE, RESOURCE_FIELD, 'could not run'], [ENGINE_VALUE]);
			assert.deepEqual(bridge.registered, []);
		});

		/** A probe's rejection as the router's probe makes it: its own message over the client's error, carrying the engine's report. */
		const probeFailure = (): Error =>
			new Error('probe failed', {
				cause: Object.assign(new Error('search_phase_execution_exception'), {
					meta: {
						body: {
							error: { reason: `failed on ${ENGINE_VALUE}`, type: 'search_phase_execution_exception' },
						},
					},
				}),
			});

		const ENGINE_CAUSE = [
			{ message: 'probe failed' },
			{
				engineError: { reason: `failed on ${ENGINE_VALUE}`, type: 'search_phase_execution_exception' },
				message: 'search_phase_execution_exception',
			},
		];

		const rejecting = async (): Promise<never> => {
			throw probeFailure();
		};

		for (const [description, answers, fields] of [
			[
				'the count of records holding several resource values',
				{ countRecordsHoldingSeveralValues: rejecting },
				{ catalogue: NAMED_CATALOGUE, check: 'countRecordsHoldingSeveralValues', field: RESOURCE_FIELD },
			],
			[
				"a condition's validation",
				{ validate: rejecting },
				{ catalogue: NAMED_CATALOGUE, category: 'global.controlled', check: 'validate' },
			],
			[
				"a condition's count",
				{ countMatching: rejecting },
				{ catalogue: NAMED_CATALOGUE, category: 'global.controlled', check: 'countMatching' },
			],
		] as const) {
			test(`logs the engine's cause when ${description} could not run, once, at error, as plain data`, async () => {
				// Given an engine failing that check
				const { accessControl, lines } = adapterOver({ [NAMED_CATALOGUE]: SENTINEL_REGISTRATION });
				const { probe } = createStubProbe(answers);

				// When the adapter verifies the catalogue
				await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) }));

				// Then one startup_check_failed event carries the check and each cause down its chain, the engine's
				// report included, as data a JSON line keeps whole
				const failures = lines.filter(({ message }) => message === EVENTS.startupCheckFailed);
				assert.deepEqual(failures, [
					{ fields: { ...fields, cause: ENGINE_CAUSE }, level: 'error', message: EVENTS.startupCheckFailed },
				]);
				assert.deepEqual(JSON.parse(JSON.stringify(failures[0]?.fields)), failures[0]?.fields);
			});
		}

		test("refuses a catalogue whose category condition the engine refuses, naming the catalogue and the category and nothing of the engine's explanation", async () => {
			// Given an engine refusing the condition's query, explaining with a value
			const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: SENTINEL_REGISTRATION });
			const { calls, probe } = createStubProbe({
				validate: async () => ({ explanation: `failed to parse [${ENGINE_VALUE}]`, valid: false }),
			});

			// When the adapter verifies it
			const refusal = await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) }));

			// Then startup fails naming the catalogue and the category, holding neither the engine's explanation
			// nor the condition's value, the refused condition was not counted, and nothing is registered
			assertNames(refusal, [NAMED_CATALOGUE, 'global.controlled'], [ENGINE_VALUE, CONDITION_VALUE]);
			assert.deepEqual(
				calls.filter(({ check }) => check === 'countMatching'),
				[],
			);
			assert.deepEqual(bridge.registered, []);
		});

		test("logs the engine's explanation for each condition it refuses, once, at error, naming the catalogue and the category", async () => {
			// Given an engine refusing every condition, one global and one of REEF_ARCHIVE's own among them
			const { accessControl, lines } = adapterOver({ [NAMED_CATALOGUE]: RESOURCE_CATEGORY_REGISTRATION });
			const { probe } = createStubProbe({
				validate: async () => ({ explanation: `failed to parse [${ENGINE_VALUE}]`, valid: false }),
			});

			// When the adapter verifies it
			await refusalOf(accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) }));

			// Then one condition_refused event per condition carries its catalogue, its category, the resource
			// of a resource's own, and the engine's explanation
			const explanation = `failed to parse [${ENGINE_VALUE}]`;
			assert.deepEqual(
				lines.toSorted((first, second) =>
					String(first.fields['category']).localeCompare(String(second.fields['category'])),
				),
				[
					{
						fields: { catalogue: NAMED_CATALOGUE, category: 'global.community-governed', explanation },
						level: 'error',
						message: EVENTS.conditionRefused,
					},
					{
						fields: { catalogue: NAMED_CATALOGUE, category: 'global.controlled', explanation },
						level: 'error',
						message: EVENTS.conditionRefused,
					},
					{
						fields: {
							catalogue: NAMED_CATALOGUE,
							category: REEF_CATEGORY,
							explanation,
							resourceId: 'REEF_ARCHIVE',
						},
						level: 'error',
						message: EVENTS.conditionRefused,
					},
				],
			);
		});

		const UNANSWERED_CONDITION_CHECKS: [string, Partial<IndexProbe>][] = [
			[
				'validated',
				{
					validate: async () => {
						throw new Error(`no answer about ${ENGINE_VALUE}`);
					},
				},
			],
			[
				'counted',
				{
					countMatching: async () => {
						throw new Error(`no count for ${ENGINE_VALUE}`);
					},
				},
			],
		];

		for (const [description, answers] of UNANSWERED_CONDITION_CHECKS) {
			test(`refuses a catalogue whose category condition could not be ${description}, naming the catalogue and the category`, async () => {
				// Given an engine failing to answer about the condition
				const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: SENTINEL_REGISTRATION });
				const { probe } = createStubProbe(answers);

				// When the adapter verifies it
				const refusal = await refusalOf(
					accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) }),
				);

				// Then startup fails closed, naming the catalogue and the category and nothing the engine said
				assertNames(
					refusal,
					[NAMED_CATALOGUE, 'global.controlled', 'could not'],
					[ENGINE_VALUE, CONDITION_VALUE],
				);
				assert.deepEqual(bridge.registered, []);
			});
		}

		test('warns of a category matching no record, naming the catalogue and the category and no value, and still registers it', async () => {
			// Given an index where the category's condition matches no record
			const { accessControl, bridge, lines } = adapterOver({ [NAMED_CATALOGUE]: SENTINEL_REGISTRATION });
			const { probe } = createStubProbe({ countMatching: async () => 0 });

			// When the adapter verifies it
			await accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) });

			// Then one warning names the catalogue and the category, holding no value, and the catalogue is registered
			assert.deepEqual(lines, [
				{
					fields: { catalogue: NAMED_CATALOGUE, category: 'global.controlled' },
					level: 'warn',
					message: EVENTS.categoryMatchesNoRecord,
				},
			]);
			assert.equal(JSON.stringify(lines).includes(CONDITION_VALUE), false);
			assert.deepEqual(bridge.registered, [{ [NAMED_CATALOGUE]: SENTINEL_REGISTRATION }]);
		});

		test("warns of a resource's own category matching no record within that resource, naming the resource", async () => {
			// Given an index where REEF_ARCHIVE's own category matches none of its records, and every
			// global category matches some
			const { accessControl, lines } = adapterOver({ [NAMED_CATALOGUE]: RESOURCE_CATEGORY_REGISTRATION });
			const scopedReefCondition = JSON.stringify(withinResource('REEF_ARCHIVE', REEF_CONDITION));
			const { probe } = createStubProbe({
				countMatching: async (condition) => (JSON.stringify(condition) === scopedReefCondition ? 0 : 2),
			});

			// When the adapter verifies it
			await accessControl.verify({ [NAMED_CATALOGUE]: indexOf(INDEX_MAPPING, probe) });

			// Then the one warning names the catalogue, the category and its resource
			assert.deepEqual(lines, [
				{
					fields: { catalogue: NAMED_CATALOGUE, category: REEF_CATEGORY, resourceId: 'REEF_ARCHIVE' },
					level: 'warn',
					message: EVENTS.categoryMatchesNoRecord,
				},
			]);
		});

		test("reports every catalogue's reasons in one refusal, and registers nothing", async () => {
			// Given two catalogues, one whose resource field holds several values and one whose condition the
			// engine refuses
			const { accessControl, bridge } = adapterOver({
				[NAMED_CATALOGUE]: RECORDS_REGISTRATION,
				[OTHER_CATALOGUE]: SENTINEL_REGISTRATION,
			});

			// When the adapter verifies both
			const refusal = await refusalOf(
				accessControl.verify({
					[NAMED_CATALOGUE]: indexOf(
						INDEX_MAPPING,
						createStubProbe({ countRecordsHoldingSeveralValues: async () => 2 }).probe,
					),
					[OTHER_CATALOGUE]: indexOf(
						INDEX_MAPPING,
						createStubProbe({ validate: async () => ({ explanation: ENGINE_VALUE, valid: false }) }).probe,
					),
				}),
			);

			// Then the one refusal names both catalogues and both reasons, and nothing is registered
			assertNames(refusal, [NAMED_CATALOGUE, '2 records', OTHER_CATALOGUE, 'global.controlled'], [ENGINE_VALUE]);
			assert.deepEqual(bridge.registered, []);
		});

		test('registers with the bridge only once every check has answered', async () => {
			// Given an index whose count of a condition's records has not answered yet
			const { accessControl, bridge } = adapterOver({ records: RECORDS_REGISTRATION });
			const pending = deferred<number>();
			const { probe } = createStubProbe({ countMatching: () => pending.promise });

			// When the adapter verifies it, and the count is still outstanding
			const verification = accessControl.verify({ records: indexOf(INDEX_MAPPING, probe) });
			await new Promise((resolve) => setImmediate(resolve));

			// Then nothing is registered until the count answers, and the catalogue is registered after
			assert.deepEqual(bridge.registered, []);
			pending.resolve(1);
			await verification;
			assert.deepEqual(bridge.registered, [{ records: RECORDS_REGISTRATION }]);
		});
	});

	suite('accepting what it can enforce on', () => {
		test('accepts a field inside a plain object, since only a nested mapping splits a record into units', async () => {
			// Given a resource field under an object mapping that is not nested
			const registration = { ...RECORDS_REGISTRATION, resourceFieldName: 'donor.study_id' };
			const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: registration });

			// When the adapter verifies it
			await accessControl.verify({
				[NAMED_CATALOGUE]: indexOf({
					...INDEX_MAPPING,
					donor: { properties: { study_id: { type: 'keyword' } } },
				}),
			});

			// Then the catalogue is registered as configured
			assert.deepEqual(bridge.registered, [{ [NAMED_CATALOGUE]: registration }]);
		});

		test('refuses an index for a catalogue its configuration does not name, naming it', async () => {
			// Given an adapter configured for one catalogue
			const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: RECORDS_REGISTRATION });

			// When it is handed an index for another as well, Then startup fails naming it, and nothing is registered
			assertNames(
				await refusalOf(
					accessControl.verify({ [NAMED_CATALOGUE]: indexOf(), [UNCONFIGURED_CATALOGUE]: indexOf() }),
				),
				[UNCONFIGURED_CATALOGUE],
			);
			assert.deepEqual(bridge.registered, []);
		});
	});

	suite('what reaches the bridge', () => {
		for (const [description, registration] of [
			['each defined category, as a scoped name against its condition', RECORDS_REGISTRATION],
			["a resource's own category, under its resource", RESOURCE_CATEGORY_REGISTRATION],
			['each declared absence, beside no defined category', ABSENT_CATEGORIES_REGISTRATION],
			['the configured resource list', RECORDS_REGISTRATION],
			['an empty resource list, unchanged', EMPTY_LIST_REGISTRATION],
			['an open catalogue as kind open, with no field names', OPEN_REGISTRATION],
		] as const) {
			test(`registers ${description}`, async () => {
				// Given a catalogue's configuration
				const { accessControl, bridge } = adapterOver({ records: registration });

				// When the adapter verifies it
				await accessControl.verify({ records: indexOf() });

				// Then the bridge receives that registration exactly
				assert.deepEqual(bridge.registered, [{ records: registration }]);
			});
		}

		test('registers every catalogue with the bridge in one call, and hands back one callback per catalogue', async () => {
			// Given two catalogues, the second defining controlled alone
			const { accessControl, bridge } = adapterOver({
				controlledOnly: CONTROLLED_ONLY_REGISTRATION,
				records: RECORDS_REGISTRATION,
			});

			// When the adapter verifies both
			await accessControl.verify({ controlledOnly: indexOf(), records: indexOf() });

			// Then one registration holds both, and each catalogue has a callback of its own
			assert.deepEqual(bridge.registered, [
				{ controlledOnly: CONTROLLED_ONLY_REGISTRATION, records: RECORDS_REGISTRATION },
			]);
			assert.equal(typeof accessControl.filterFor('records'), 'function');
			assert.notEqual(accessControl.filterFor('records'), accessControl.filterFor('controlledOnly'));
		});

		test('registers a catalogue that failed to load but never verifies it, so it serves nothing while the others serve', async () => {
			// Given two catalogues, one of which failed to load, so its index never arrived
			const { accessControl, bridge } = adapterOver({
				controlledOnly: CONTROLLED_ONLY_REGISTRATION,
				records: RECORDS_REGISTRATION,
			});
			const failedCallback = accessControl.filterFor('controlledOnly');
			const loadedCallback = accessControl.filterFor('records');

			// When the adapter verifies the one that loaded
			await accessControl.verify({ records: indexOf() });

			// Then both are registered, since the bridge takes its registrations once
			assert.deepEqual(bridge.registered, [
				{ controlledOnly: CONTROLLED_ONLY_REGISTRATION, records: RECORDS_REGISTRATION },
			]);

			// And a request reaching the failed one throws, while the loaded one applies its result
			const locals = {};
			attachAccess(
				locals,
				accessOf(ANONYMOUS, {
					controlledOnly: CONTROLLED_ONLY_ANONYMOUS.result,
					records: ROWS.anonymousBaselineOn.result,
				}),
			);
			assert.throws(() => failedCallback({ locals }, { readPath: 'hits' }), isConfigurationRefusal);
			assert.deepEqual(
				loadedCallback({ locals }, { readPath: 'hits' }),
				ROWS.anonymousBaselineOn.result.kind === 'narrow' ? ROWS.anonymousBaselineOn.result.sqon : null,
			);
		});

		test('refuses a second verification, since the bridge takes its registrations once', async () => {
			// Given an adapter already verified
			const { accessControl, bridge } = adapterOver({ records: RECORDS_REGISTRATION });
			await accessControl.verify({ records: indexOf() });

			// When it is verified again, Then it refuses, and registers nothing more
			await assert.rejects(accessControl.verify({ records: indexOf() }));
			assert.equal(bridge.registered.length, 1);
		});

		test('refuses a verification started while another is running, registering once', async () => {
			// Given a verification still waiting on its index
			const { accessControl, bridge } = adapterOver({ records: RECORDS_REGISTRATION });
			const pending = deferred<number>();
			const first = accessControl.verify({
				records: indexOf(INDEX_MAPPING, createStubProbe({ countMatching: () => pending.promise }).probe),
			});

			// When a second starts, Then it refuses, and the first registers once it answers
			await assert.rejects(accessControl.verify({ records: indexOf() }));
			pending.resolve(1);
			await first;
			assert.equal(bridge.registered.length, 1);
		});
	});

	suite('against a real bridge, never started', () => {
		for (const [description, registration] of [
			['defining both categories', RECORDS_REGISTRATION],
			['defining controlled alone', CONTROLLED_ONLY_REGISTRATION],
			["defining a resource's own category", RESOURCE_CATEGORY_REGISTRATION],
			['declaring both categories absent', ABSENT_CATEGORIES_REGISTRATION],
			['registering an empty resource list', EMPTY_LIST_REGISTRATION],
			['open by configuration', OPEN_REGISTRATION],
		] as const) {
			test(`builds a registration the real bridge accepts: a catalogue ${description}`, async () => {
				// Given the real bridge, which checks registrations as Usher does and needs no controller unstarted
				const { logger } = createRecordingLogger();
				const bridge = unstartedBridge(logger);
				const accessControl = createUsherAccessControl({
					bridge,
					catalogues: { records: registration },
					logger,
				});

				try {
					// When the adapter verifies the catalogue, Then the bridge's register accepts it
					await accessControl.verify({ records: indexOf() });
				} finally {
					await bridge.stop();
				}
			});
		}

		test("fails startup with the bridge's own refusal for a bridge configuration start refuses, logging it through the shim", async () => {
			// Given a bridge whose event source is empty, logging through the adapter's shim
			const written: string[] = [];
			const logger = createBridgeLogger({ write: (line: string) => written.push(line) });
			const bridge = createBridgeCore(bridgeConfiguration(logger, { eventSource: '' }));
			bridge.register({ records: RECORDS_REGISTRATION });

			// When the bridge starts, Then it refuses with its own error, and the shim wrote the refusal
			await assert.rejects(() => bridge.start(), UsherContractError);
			await bridge.stop();
			const events = written.map((line) => JSON.parse(line) as Record<string, unknown>);
			assert.ok(
				events.some((event) => event['type'] === 'bio.overture.bridge.startRefusal'),
				`the shim wrote ${written.length} lines, none the start refusal`,
			);
		});
	});

	test('refuses a callback called before its catalogue is verified', () => {
		// Given an adapter whose catalogue was never verified, and a request whose access is otherwise
		// complete, so the missing verification is the only reason left to refuse it
		const { accessControl } = adapterOver({ records: RECORDS_REGISTRATION });
		const callback = accessControl.filterFor('records');
		const locals = {};
		attachAccess(locals, accessOf(ANONYMOUS, { records: ROWS.anonymousBaselineOn.result }));

		// When the request reaches the callback, Then it refuses it as a misconfiguration rather than serve
		// an unchecked catalogue, and never as a refusal the client could retry
		assert.throws(() => callback({ locals }, { readPath: 'hits' }), isConfigurationRefusal);
	});
});
