import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { suite, test } from 'node:test';

import {
	type BridgeConfiguration,
	type BridgeCore,
	type BridgeLogger,
	createBridgeCore,
	type KeyRegistration,
} from '@overture-stack/usher-express-bridge';
import { attachAccess, UsherContractError } from '@overture-stack/usher-types';

import { isConfigurationRefusal } from './fixtures/arrangerNames.js';
import {
	ABSENT_CATEGORIES_REGISTRATION,
	CONTROLLED_ONLY_REGISTRATION,
	EMPTY_LIST_REGISTRATION,
	INDEX_MAPPING,
	OPEN_REGISTRATION,
	RECORDS_REGISTRATION,
} from './fixtures/catalogue.js';
import { createFakeBridge } from './fixtures/fakeBridge.js';
import { createRecordingLogger } from './fixtures/recordingLogger.js';
import { accessOf, ANONYMOUS, CONTROLLED_ONLY_ANONYMOUS, ROWS } from './fixtures/results.js';
import { createBridgeLogger, createUsherAccessControl } from './index.js';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64url');

/** A real bridge, never started, so it needs no controller: its `register` checks registrations as Usher does. */
const unstartedBridge = (logger: BridgeLogger): BridgeCore => createBridgeCore(bridgeConfiguration(logger));

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

const fakeTable = { anonymous: { records: ROWS.anonymousBaselineOn.result }, principals: {} };

/** The adapter over a fake bridge, with its catalogues configured as given. */
const adapterOver = (catalogues: Readonly<Record<string, KeyRegistration>>) => {
	const bridge = createFakeBridge(fakeTable);
	const { logger } = createRecordingLogger();
	const accessControl = createUsherAccessControl({ bridge: bridge.core, catalogues, logger });
	return { accessControl, bridge };
};

/** What a refusal says, message and problems alike, so a test can ask whether it names something. */
const describeRefusal = (error: unknown): string =>
	error instanceof Error
		? JSON.stringify({ message: error.message, problems: (error as { problems?: unknown }).problems ?? null })
		: String(error);

/**
 * Catalogue keys no refusal's prose would contain by chance, so a check that a refusal names one
 * cannot pass on its wording alone.
 */
const NAMED_CATALOGUE = 'catalogue-k7';
const UNCONFIGURED_CATALOGUE = 'missing-catalogue-k9';

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

	suite('checking each catalogue against its index mapping', () => {
		for (const [description, mapping, field] of [
			['its resource field absent', { ...INDEX_MAPPING, study_id: undefined }, 'study_id'],
			['its category field absent', { ...INDEX_MAPPING, data_category: undefined }, 'data_category'],
		] as const) {
			test(`refuses a catalogue whose mapping has ${description}, naming the catalogue and the field`, () => {
				// Given the catalogue's index mapping lacks a field its configuration names
				const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: RECORDS_REGISTRATION });
				const fetched = Object.fromEntries(Object.entries(mapping).filter(([, value]) => value !== undefined));

				// When the adapter verifies it, Then startup fails naming both, and nothing is registered
				assert.throws(
					() => accessControl.verify({ [NAMED_CATALOGUE]: fetched }),
					(error: unknown) =>
						describeRefusal(error).includes(NAMED_CATALOGUE) && describeRefusal(error).includes(field),
				);
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
			test(`refuses to enforce on ${description}`, () => {
				// Given a mapped field whose mapping shape the adapter cannot enforce on
				const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: catalogue });

				// When the adapter verifies it, Then startup fails naming the catalogue and the field, since
				// enforcing anyway would be guesswork
				assert.throws(
					() => accessControl.verify({ [NAMED_CATALOGUE]: mapping }),
					(error: unknown) =>
						describeRefusal(error).includes(NAMED_CATALOGUE) && describeRefusal(error).includes(field),
				);
				assert.deepEqual(bridge.registered, []);
			});
		}
	});

	suite('accepting what it can enforce on', () => {
		test('accepts a field inside a plain object, since only a nested mapping splits a record into units', () => {
			// Given a resource field under an object mapping that is not nested
			const registration = { ...RECORDS_REGISTRATION, resourceFieldName: 'donor.study_id' };
			const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: registration });

			// When the adapter verifies it
			accessControl.verify({
				[NAMED_CATALOGUE]: { ...INDEX_MAPPING, donor: { properties: { study_id: { type: 'keyword' } } } },
			});

			// Then the catalogue is registered as configured
			assert.deepEqual(bridge.registered, [{ [NAMED_CATALOGUE]: registration }]);
		});

		test('refuses a mapping for a catalogue its configuration does not name, naming it', () => {
			// Given an adapter configured for one catalogue
			const { accessControl, bridge } = adapterOver({ [NAMED_CATALOGUE]: RECORDS_REGISTRATION });

			// When it is handed a mapping for another as well, Then startup fails naming it, and nothing is registered
			assert.throws(
				() =>
					accessControl.verify({ [NAMED_CATALOGUE]: INDEX_MAPPING, [UNCONFIGURED_CATALOGUE]: INDEX_MAPPING }),
				(error: unknown) => describeRefusal(error).includes(UNCONFIGURED_CATALOGUE),
			);
			assert.deepEqual(bridge.registered, []);
		});
	});

	suite('what reaches the bridge', () => {
		for (const [description, registration] of [
			[
				'each mapped category, as a scoped name against the value its records hold, with the category field named',
				RECORDS_REGISTRATION,
			],
			['each declared absence, with no category field and no mapped value', ABSENT_CATEGORIES_REGISTRATION],
			['the configured resource list', RECORDS_REGISTRATION],
			['an empty resource list, unchanged', EMPTY_LIST_REGISTRATION],
			['an open catalogue as kind open, with no field names', OPEN_REGISTRATION],
		] as const) {
			test(`registers ${description}`, () => {
				// Given a catalogue's configuration
				const { accessControl, bridge } = adapterOver({ records: registration });

				// When the adapter verifies it
				accessControl.verify({ records: INDEX_MAPPING });

				// Then the bridge receives that registration exactly
				assert.deepEqual(bridge.registered, [{ records: registration }]);
			});
		}

		test('registers every catalogue with the bridge in one call, and hands back one callback per catalogue', () => {
			// Given two catalogues, the second mapping controlled alone
			const { accessControl, bridge } = adapterOver({
				controlledOnly: CONTROLLED_ONLY_REGISTRATION,
				records: RECORDS_REGISTRATION,
			});

			// When the adapter verifies both
			accessControl.verify({ controlledOnly: INDEX_MAPPING, records: INDEX_MAPPING });

			// Then one registration holds both, and each catalogue has a callback of its own
			assert.deepEqual(bridge.registered, [
				{ controlledOnly: CONTROLLED_ONLY_REGISTRATION, records: RECORDS_REGISTRATION },
			]);
			assert.equal(typeof accessControl.filterFor('records'), 'function');
			assert.notEqual(accessControl.filterFor('records'), accessControl.filterFor('controlledOnly'));
		});

		test('registers a catalogue that failed to load but never verifies it, so it serves nothing while the others serve', () => {
			// Given two catalogues, one of which failed to load, so its mapping never arrived
			const { accessControl, bridge } = adapterOver({
				controlledOnly: CONTROLLED_ONLY_REGISTRATION,
				records: RECORDS_REGISTRATION,
			});
			const failedCallback = accessControl.filterFor('controlledOnly');
			const loadedCallback = accessControl.filterFor('records');

			// When the adapter verifies the one that loaded
			accessControl.verify({ records: INDEX_MAPPING });

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

		test('refuses a second verification, since the bridge takes its registrations once', () => {
			// Given an adapter already verified
			const { accessControl, bridge } = adapterOver({ records: RECORDS_REGISTRATION });
			accessControl.verify({ records: INDEX_MAPPING });

			// When it is verified again, Then it refuses, and registers nothing more
			assert.throws(() => accessControl.verify({ records: INDEX_MAPPING }));
			assert.equal(bridge.registered.length, 1);
		});
	});

	suite('against a real bridge, never started', () => {
		for (const [description, registration] of [
			['mapping both categories', RECORDS_REGISTRATION],
			['mapping controlled alone', CONTROLLED_ONLY_REGISTRATION],
			['declaring both categories absent', ABSENT_CATEGORIES_REGISTRATION],
			['registering an empty resource list', EMPTY_LIST_REGISTRATION],
			['open by configuration', OPEN_REGISTRATION],
		] as const) {
			test(`builds a registration the real bridge accepts: a catalogue ${description}`, () => {
				// Given the real bridge, which checks registrations as Usher does and needs no controller unstarted
				const { logger } = createRecordingLogger();
				const accessControl = createUsherAccessControl({
					bridge: unstartedBridge(logger),
					catalogues: { records: registration },
					logger,
				});

				// When the adapter verifies the catalogue, Then the bridge's register accepts it
				assert.doesNotThrow(() => accessControl.verify({ records: INDEX_MAPPING }));
			});
		}

		for (const [description, registration] of [
			['a category mapped with no category field', { ...RECORDS_REGISTRATION, categoryFieldName: undefined }],
			[
				'two categories mapped to one value',
				{
					...RECORDS_REGISTRATION,
					categoryValues: { 'global.community-governed': 'controlled', 'global.controlled': 'controlled' },
				},
			],
			[
				'a declared absence beside a category field',
				{ ...RECORDS_REGISTRATION, absentCategories: ['global.community-governed'] },
			],
			[
				'a mapped value holding the * marker',
				{ ...RECORDS_REGISTRATION, categoryValues: { 'global.controlled': '*' } },
			],
			['a resource holding the set_id: marker', { ...RECORDS_REGISTRATION, resources: ['set_id:HEART_STUDY'] }],
			[
				'a mapped value holding the __missing__ marker',
				{ ...RECORDS_REGISTRATION, categoryValues: { 'global.controlled': '__missing__' } },
			],
		] as const) {
			test(`fails startup before the bridge starts, naming the catalogue, for ${description}`, () => {
				// Given a mapping the bridge's registration refuses
				const { logger } = createRecordingLogger();
				const accessControl = createUsherAccessControl({
					bridge: unstartedBridge(logger),
					catalogues: { [NAMED_CATALOGUE]: registration as KeyRegistration },
					logger,
				});

				// When the adapter verifies it, Then the refusal names the catalogue
				assert.throws(
					() => accessControl.verify({ [NAMED_CATALOGUE]: INDEX_MAPPING }),
					(error: unknown) => describeRefusal(error).includes(NAMED_CATALOGUE),
				);
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
