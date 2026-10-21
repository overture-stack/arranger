import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import type { CatalogueIndex, UsherAccessControl } from '@overture-stack/arranger-usher-adapter';
import type { BridgeCore } from '@overture-stack/usher-express-bridge';

import { type ImageUsher, stopUsherBridge, verifyAndStartUsher } from './usher.js';

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
			countRecordsHoldingSeveralValues: async () => 0,
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

	test("refuses startup with the verification's own refusal, logged as access_control.startup_refused, and never starts the bridge", async (context) => {
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
			['access_control.startup_refused'],
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
			['access_control.bridge_stop_failed'],
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
			['access_control.bridge_stop_failed'],
		);
	});
});
