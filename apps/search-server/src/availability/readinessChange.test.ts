import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { createReadinessChangeDetector, type ReadinessObservation } from './readinessChange.js';
import { serverAggregateStatuses } from './types.js';

const ready: ReadinessObservation = {
	bridgeMode: 'normal',
	causes: [],
	engineReachable: true,
	ready: true,
	status: serverAggregateStatuses.HEALTHY,
};

const engineDown: ReadinessObservation = {
	...ready,
	causes: ['search engine unreachable'],
	engineReachable: false,
	ready: false,
};

const bridgeCold: ReadinessObservation = {
	...ready,
	bridgeMode: 'cold',
	causes: ['Bridge not yet serving'],
	ready: false,
};

suite('createReadinessChangeDetector', () => {
	test('reports a change on the first observation, so the starting state is logged once', () => {
		const changed = createReadinessChangeDetector();

		assert.equal(changed(ready), true);
	});

	test('reports no change while the answer and its causes repeat', () => {
		const changed = createReadinessChangeDetector();
		changed(engineDown);

		assert.equal(changed({ ...engineDown }), false);
		assert.equal(changed({ ...engineDown }), false);
	});

	test('reports a change when the server stops being ready', () => {
		const changed = createReadinessChangeDetector();
		changed(ready);

		assert.equal(changed(engineDown), true);
	});

	test('reports a change when the server becomes ready again', () => {
		const changed = createReadinessChangeDetector();
		changed(engineDown);

		assert.equal(changed(ready), true);
	});

	test('reports a change when the cause shifts while the server stays not ready', () => {
		const changed = createReadinessChangeDetector();
		changed(engineDown);

		assert.equal(changed(bridgeCold), true);
	});

	test('reports a change when a second cause joins the first', () => {
		const changed = createReadinessChangeDetector();
		changed(engineDown);

		assert.equal(
			changed({
				...engineDown,
				bridgeMode: 'cold',
				causes: ['search engine unreachable', 'Bridge not yet serving'],
			}),
			true,
		);
	});

	test('reports no change when an input moves but the server stays ready', () => {
		const changed = createReadinessChangeDetector();
		changed(ready);

		assert.equal(changed({ ...ready, bridgeMode: 'uncertain', status: serverAggregateStatuses.DEGRADED }), false);
	});
});
