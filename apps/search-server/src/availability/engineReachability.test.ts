import assert from 'node:assert/strict';
import { afterEach, mock, suite, test } from 'node:test';

import { startEngineProbe } from './engineReachability.js';

/** Lets the probe's fired-but-not-awaited promise settle before asserting on its result. */
const settled = () => new Promise((resolve) => setImmediate(resolve));

/** A client whose `indices.exists` outcome can be switched between probes. */
const clientThat = (behaviour: { failing: boolean }) =>
	({
		indices: {
			exists: async () => {
				if (behaviour.failing) {
					throw new Error('connect ECONNREFUSED');
				}
				return { statusCode: 404 };
			},
		},
	}) as never;

suite('startEngineProbe', () => {
	afterEach(() => mock.restoreAll());

	test('is inert and reports reachable when no client is supplied', async () => {
		const probe = startEngineProbe({ esClient: undefined, index: 'anything', intervalMs: 10 });

		assert.equal(probe.isReachable(), true);
		assert.doesNotThrow(() => probe.stop());
	});

	test('reports reachable when the engine answers, whatever it answers', async () => {
		const probe = startEngineProbe({ esClient: clientThat({ failing: false }), index: 'idx', intervalMs: 1000 });
		await settled();

		assert.equal(probe.isReachable(), true);
		probe.stop();
	});

	test('reports unreachable when the request fails', async () => {
		mock.method(console, 'error', () => {});
		const probe = startEngineProbe({ esClient: clientThat({ failing: true }), index: 'idx', intervalMs: 1000 });
		await settled();

		assert.equal(probe.isReachable(), false);
		probe.stop();
	});

	test('recovers without a restart once the engine answers again', async () => {
		mock.method(console, 'error', () => {});
		mock.method(console, 'log', () => {});
		const behaviour = { failing: true };
		const probe = startEngineProbe({ esClient: clientThat(behaviour), index: 'idx', intervalMs: 5 });
		await settled();
		assert.equal(probe.isReachable(), false);

		behaviour.failing = false;
		await new Promise((resolve) => setTimeout(resolve, 30));

		assert.equal(probe.isReachable(), true);
		probe.stop();
	});

	test('stops probing once stopped, so a later failure does not change the result', async () => {
		const behaviour = { failing: false };
		const probe = startEngineProbe({ esClient: clientThat(behaviour), index: 'idx', intervalMs: 5 });
		await settled();
		probe.stop();

		behaviour.failing = true;
		await new Promise((resolve) => setTimeout(resolve, 30));

		assert.equal(probe.isReachable(), true);
	});

	test('logs once per transition rather than on every failing probe', async () => {
		const errors: unknown[] = [];
		mock.method(console, 'error', (message: unknown) => void errors.push(message));
		const probe = startEngineProbe({ esClient: clientThat({ failing: true }), index: 'idx', intervalMs: 5 });
		await new Promise((resolve) => setTimeout(resolve, 30));
		probe.stop();

		assert.equal(errors.length, 1);
	});
});
