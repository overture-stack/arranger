import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import type { CatalogueIndex, UsherAccessControl } from '@overture-stack/arranger-usher-adapter';
import type { BridgeCore } from '@overture-stack/usher-bridge--express';

import { type ImageUsher, stopUsherBridge, verifyAndStartUsher, withUsherFilters } from './usher.js';

/** What a fake's calls did, in the order they happened. */
type Step = 'rejected' | 'started' | 'stopped' | 'verified';

/** A bridge whose start and stop are given, recording each step it reaches into `steps`. */
const bridgeWith = ({
	start = async () => undefined,
	steps,
	stop = async () => undefined,
}: {
	start?: () => Promise<void>;
	steps: Step[];
	stop?: () => Promise<void>;
}): BridgeCore => ({
	applyNotice: () => undefined,
	mode: () => 'normal',
	refreshAnonymous: async () => true,
	register: () => undefined,
	report: () => undefined,
	reset: () => undefined,
	resolve: async () => ({ kind: 'unavailable' }),
	start: async () => {
		await start();
		steps.push('started');
	},
	stop: async () => {
		await stop();
		steps.push('stopped');
	},
});

/** The image's Usher over `bridge`, its adapter's verification given. */
const usherOver = (bridge: BridgeCore, verify: UsherAccessControl['verify']): ImageUsher => ({
	accessControl: {
		filterFor: () => () => {
			throw new Error('No request reaches a filter in these tests.');
		},
		requesterOf: () => {
			throw new Error('No request reaches a filter in these tests.');
		},
		verify,
	},
	bridge,
	layer: (_request, _response, next) => next(),
});

/** Settles on the next turn of the event loop, so a stop waiting on it is still running when awaited. */
const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const INDICES: Readonly<Record<string, CatalogueIndex>> = {
	'catalogue-k7': {
		mapping: { study_id: { type: 'keyword' } },
		probe: {
			countMatching: async () => 1,
			countRecordsAndValues: async () => ({ records: 0, values: 0 }),
			validate: async () => ({ valid: true }),
		},
	},
};

suite('verifying and starting Usher before the image listens', () => {
	test('verifies every catalogue with its index, then starts the bridge', async () => {
		// Given an adapter whose verification passes
		const steps: Step[] = [];
		const handed: unknown[] = [];
		const usher = usherOver(bridgeWith({ steps }), async (indices) => {
			handed.push(indices);
			steps.push('verified');
		});

		// When Usher is verified and started
		await verifyAndStartUsher({ indices: INDICES, usher });

		// Then the adapter was handed each catalogue's index, and the bridge started after it verified them
		assert.deepEqual(handed, [INDICES]);
		assert.deepEqual(steps, ['verified', 'started']);
	});

	test("refuses startup with the verification's own refusal, logged as access_enforcement.startup_refused, and never starts the bridge", async (context) => {
		// Given an adapter refusing a catalogue
		const errors = context.mock.method(console, 'error', () => undefined);
		const steps: Step[] = [];
		const refusal = new Error('catalogue "catalogue-k7": refused');
		const usher = usherOver(bridgeWith({ steps }), async () => {
			throw refusal;
		});

		// When Usher is verified and started, Then it rejects with that refusal, logged, and the bridge never started
		await assert.rejects(verifyAndStartUsher({ indices: INDICES, usher }), (error: unknown) => error === refusal);
		assert.deepEqual(
			errors.mock.calls.map(({ arguments: [event] }) => event),
			['access_enforcement.startup_refused'],
		);
		assert.deepEqual(steps, []);
	});

	test("stops a bridge that fails to start, and rejects with the start's own error only once the stop has settled", async () => {
		// Given a bridge whose start fails, and whose stop settles a turn later
		const steps: Step[] = [];
		const startFailure = new Error('the bridge could not start');
		const usher = usherOver(
			bridgeWith({
				start: async () => {
					throw startFailure;
				},
				steps,
				stop: nextTurn,
			}),
			async () => undefined,
		);

		// When Usher is verified and started
		const outcome = verifyAndStartUsher({ indices: INDICES, usher }).finally(() => steps.push('rejected'));

		// Then it rejects with the start's own error, after the stop has settled
		await assert.rejects(outcome, (error: unknown) => error === startFailure);
		assert.deepEqual(steps, ['stopped', 'rejected']);
	});

	test("rejects with the start's own error when the stop also fails, logging the stop's failure", async (context) => {
		// Given a bridge whose start and stop both fail
		const errors = context.mock.method(console, 'error', () => undefined);
		const startFailure = new Error('the bridge could not start');
		const usher = usherOver(
			bridgeWith({
				start: async () => {
					throw startFailure;
				},
				steps: [],
				stop: async () => {
					throw new Error('the bridge could not stop');
				},
			}),
			async () => undefined,
		);

		// When Usher is verified and started, Then the start's error is the one rejected with, and the stop's
		// failure is logged
		await assert.rejects(
			verifyAndStartUsher({ indices: INDICES, usher }),
			(error: unknown) => error === startFailure,
		);
		assert.deepEqual(
			errors.mock.calls.map(({ arguments: [event] }) => event),
			['access_enforcement.bridge_stop_failed'],
		);
	});
});

suite('stopping the bridge', () => {
	test('settles only once the bridge has stopped', async () => {
		// Given a bridge whose stop settles a turn later
		const steps: Step[] = [];
		const bridge = bridgeWith({ steps, stop: nextTurn });

		// When it is stopped, Then the stop has settled by the time stopping resolves
		await stopUsherBridge(bridge);
		assert.deepEqual(steps, ['stopped']);
	});

	test('resolves when the bridge fails to stop, logging the failure', async (context) => {
		// Given a bridge whose stop fails
		const errors = context.mock.method(console, 'error', () => undefined);
		const bridge = bridgeWith({
			steps: [],
			stop: async () => {
				throw new Error('the bridge could not stop');
			},
		});

		// When it is stopped, Then stopping resolves, and the failure is logged
		await stopUsherBridge(bridge);
		assert.deepEqual(
			errors.mock.calls.map(({ arguments: [event] }) => event),
			['access_enforcement.bridge_stop_failed'],
		);
	});
});

suite("each catalogue's access control under Usher", () => {
	test("gives each catalogue the adapter's filter callback for it, and the adapter's answer to who made a request", () => {
		// Given an adapter whose callbacks and requester answer are told apart by identity
		const callbacks = new Map<string, ReturnType<UsherAccessControl['filterFor']>>();
		const requesterOf: UsherAccessControl['requesterOf'] = () => ({ id: 'subject-k7', kind: 'principal' });
		const accessControl: UsherAccessControl = {
			filterFor: (catalogueId) => {
				const callback = (() => {
					throw new Error(`No request reaches ${catalogueId}'s filter in this test.`);
				}) as ReturnType<UsherAccessControl['filterFor']>;
				callbacks.set(catalogueId, callback);
				return callback;
			},
			requesterOf,
			verify: async () => undefined,
		};

		// When the image attaches it to two catalogues
		const catalogs = withUsherFilters(
			{ 'catalogue-k7': { esIndex: 'k7' }, 'catalogue-k8': { esIndex: 'k8' } },
			accessControl,
		);

		// Then each keeps its own configuration, with its own callback and the one requester answer
		assert.deepEqual(
			Object.entries(catalogs).map(([catalogueId, configs]) => [
				catalogueId,
				configs.esIndex,
				configs.getServerSideFilter === callbacks.get(catalogueId),
				configs.getRequester === requesterOf,
			]),
			[
				['catalogue-k7', 'k7', true, true],
				['catalogue-k8', 'k8', true, true],
			],
		);
	});

	test("makes each catalogue's configured row limit a ceiling, keeping its other download settings, whatever its files say", () => {
		// Given two catalogues, one whose files allow custom row limits and say the limit is no ceiling
		const accessControl = {
			filterFor: () =>
				(() => ({ content: [], op: 'and' })) as unknown as ReturnType<UsherAccessControl['filterFor']>,
			requesterOf: () => ({ kind: 'anonymous' }),
			verify: async () => undefined,
		} as unknown as UsherAccessControl;

		// When the image attaches the adapter to them
		const catalogs = withUsherFilters(
			{
				'catalogue-k7': {
					downloads: { allowCustomMaxRows: true, maxRows: 50, maxRowsIsCeiling: false },
					esIndex: 'k7',
				},
				'catalogue-k8': { esIndex: 'k8' },
			},
			accessControl,
		);

		// Then both limits are ceilings, and the first keeps the rest of its download settings
		assert.deepEqual(catalogs['catalogue-k7']?.downloads, {
			allowCustomMaxRows: true,
			maxRows: 50,
			maxRowsIsCeiling: true,
		});
		assert.deepEqual(catalogs['catalogue-k8']?.downloads, { maxRowsIsCeiling: true });
	});
});
