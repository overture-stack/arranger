import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import { MIGRATION_GUIDE_URL } from '#utils/migrationGuide.js';

import { resolveSetsIndex } from './resolveSetsIndex.js';

/**
 * A search engine holding the given indices. An index named in `refused` fails its existence check. Every call is
 * recorded, so a test can tell which index the resolution asked about, and whether it asked anything at all.
 */
const engineWith = ({ indices = [], refused = [] }: { indices?: string[]; refused?: string[] } = {}) => {
	const calls: string[] = [];
	const esClient = {
		indices: {
			create: async ({ index }: { index: string }) => {
				calls.push(`create ${index}`);
				return { acknowledged: true };
			},
			exists: async ({ index }: { index: string }) => {
				calls.push(`exists ${index}`);

				if (refused.includes(index)) {
					throw new Error('security_exception: action [indices:admin/exists] is unauthorized');
				}

				return { statusCode: indices.includes(index) ? 200 : 404 };
			},
		},
		search: async ({ index }: { index: string }) => {
			calls.push(`search ${index}`);
			return { body: { hits: { hits: [] } } };
		},
	};

	return { calls, esClient: esClient as never };
};

/** Runs `work` with console.warn captured, returning each call's arguments. */
const warningsOf = async (work: () => Promise<unknown>): Promise<unknown[][]> => {
	const warnings = mock.method(console, 'warn', () => {});

	try {
		await work();

		return warnings.mock.calls.map((call) => call.arguments);
	} finally {
		warnings.mock.restore();
	}
};

suite('resolveSetsIndex', () => {
	test('uses the configured sets index without any engine call, origin configured', async () => {
		// Given a catalogue naming its own sets index, and a legacy shared index beside it that would be refused
		const { calls, esClient } = engineWith({ refused: ['saved-sets'] });

		// When the index is resolved
		const resolution = await resolveSetsIndex({
			catalogueId: 'correlation',
			configs: { sets: { index: 'mine', legacySharedIndex: 'saved-sets' } },
			esClient,
			label: 'correlation',
			owned: false,
		});

		// Then it is the configured one, and the engine was never asked
		assert.deepEqual(resolution, { index: 'mine', kind: 'index', origin: 'configured' });
		assert.deepEqual(calls, []);
	});

	test('uses an existing legacy shared index, origin legacy-shared, warning with the migration section', async () => {
		// Given no sets index of the catalogue's own, and a legacy shared index the server names that exists
		const { calls, esClient } = engineWith({ indices: ['saved-sets'] });

		// When the index is resolved, the warning is captured
		let resolution;
		const warnings = await warningsOf(async () => {
			resolution = await resolveSetsIndex({
				catalogueId: 'correlation',
				configs: { sets: { legacySharedIndex: 'saved-sets' } },
				esClient,
				label: 'correlation',
				owned: false,
			});
		});

		// Then the legacy index is used, only its existence was checked, and nothing was created
		assert.deepEqual(resolution, { index: 'saved-sets', kind: 'index', origin: 'legacy-shared' });
		assert.deepEqual(calls, ['exists saved-sets']);
		assert.equal(warnings.length, 1);
		assert.equal(warnings[0]?.length, 1);
		const { event, level, message, time, ...fields } = JSON.parse(String(warnings[0]?.[0])) as Record<
			string,
			unknown
		>;
		assert.deepEqual([event, level], ['sets.index_legacy_shared', 'warn']);
		assert.match(String(message), /saved-sets/u);
		assert.match(String(message), new RegExp(`${MIGRATION_GUIDE_URL}#sets-index-per-catalogue`, 'u'));
		assert.equal(new Date(String(time)).toISOString(), time);
		assert.deepEqual(fields, { catalogue: 'correlation', index: 'saved-sets' });
	});

	test('is unavailable, naming the legacy index, where the legacy shared index does not exist, and never creates it', async () => {
		// Given a legacy shared index the server names, which no longer exists
		const { calls, esClient } = engineWith({});

		// When the index is resolved
		const resolution = await resolveSetsIndex({
			catalogueId: 'correlation',
			configs: { sets: { legacySharedIndex: 'saved-sets' } },
			esClient,
			label: 'correlation',
			owned: false,
		});

		// Then the catalogue is unavailable for that reason, and nothing was created
		assert.deepEqual(resolution, { index: 'saved-sets', kind: 'unavailable', reason: 'legacy_index_missing' });
		assert.equal(
			calls.some((call) => call.startsWith('create')),
			false,
		);
	});

	test('is unavailable as index_check_refused where the engine refuses the legacy index check', async () => {
		// Given an engine refusing the existence check of the legacy shared index
		const { esClient } = engineWith({ refused: ['saved-sets'] });

		// When the index is resolved
		const resolution = await resolveSetsIndex({
			catalogueId: 'correlation',
			configs: { sets: { legacySharedIndex: 'saved-sets' } },
			esClient,
			label: 'correlation',
			owned: false,
		});

		// Then the refusal is answered as unavailable, never as a silent default
		assert.deepEqual(resolution, { index: 'saved-sets', kind: 'unavailable', reason: 'index_check_refused' });
	});

	test('falls to the catalogue default, without checking any shared index, where no legacy index is named', async () => {
		// Given no sets index configured, and no legacy shared index named
		const { calls, esClient } = engineWith({ indices: ['arranger-sets'] });

		// When the index is resolved
		const resolution = await resolveSetsIndex({
			catalogueId: 'correlation',
			configs: {},
			esClient,
			label: 'correlation',
			owned: true,
		});

		// Then the catalogue's own default index is used, and the engine was never asked about any shared index
		assert.deepEqual(resolution, { index: 'arranger-sets-correlation', kind: 'index', origin: 'default' });
		assert.deepEqual(calls, []);
	});

	test('is unavailable as missing_catalogue_id under getRequester with no catalogue id, without any engine call', async () => {
		const { calls, esClient } = engineWith({});

		assert.deepEqual(await resolveSetsIndex({ configs: {}, esClient, label: 'donor', owned: true }), {
			kind: 'unavailable',
			reason: 'missing_catalogue_id',
		});
		assert.deepEqual(calls, []);
	});

	test('names the default index by the label, without getRequester', async () => {
		// Given no catalogue id, and no getRequester, so the label stands in for it
		const { esClient } = engineWith({});

		// When the index is resolved
		const resolution = await resolveSetsIndex({ configs: {}, esClient, label: 'donor', owned: false });

		// Then the default is named by the label
		assert.deepEqual(resolution, { index: 'arranger-sets-donor', kind: 'index', origin: 'default' });
	});
});
