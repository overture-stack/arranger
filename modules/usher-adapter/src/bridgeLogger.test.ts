import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { createBridgeLogger } from './index.js';

/**
 * The adapter's logger shim: the one `BridgeLogger` the image builds and hands both the bridge and the
 * adapter. Each line is written in the repository's envelope, one JSON object per line holding the
 * level, the fixed message, and the event's own fields unchanged.
 */

/** A bridge event as the bridge hands its logger: a CloudEvents envelope, and its type as the message. */
const bridgeEvent = (type: string) => ({
	data: { actorId: null, actorType: 'system', reason: 'eventSourceEmpty' },
	id: '9b2f4c1e-0d3a-4e6b-8f5a-2c7d1e9a0b34',
	severity: 'critical',
	source: 'https://search.example.org/usher-bridge',
	specversion: '1.0',
	time: '2026-10-06T21:00:00.000Z',
	type,
});

suite('the logger shim', () => {
	for (const level of ['error', 'warn', 'info'] as const) {
		test(`writes a bridge event at ${level} at that level, with the event's fields unchanged`, () => {
			// Given the shim, writing to a recorder
			const written: string[] = [];
			const logger = createBridgeLogger({ write: (line: string) => written.push(line) });
			const event = bridgeEvent('bio.overture.bridge.startRefusal');

			// When the bridge logs an event at this level
			logger[level](event, event.type);

			// Then one line holds the level, the message and the event's fields exactly
			assert.equal(written.length, 1);
			assert.deepEqual(JSON.parse(written[0] ?? 'null'), { ...event, level, message: event.type });
		});
	}

	test("keeps the line's own level and message when an event carries fields of those names", () => {
		// Given the shim, and an event whose own fields are named level and message
		const written: string[] = [];
		const logger = createBridgeLogger({ write: (line: string) => written.push(line) });

		// When the event is logged at warn
		logger.warn(
			{ level: 'error', message: 'a field, not the message', reason: 'kept' },
			'access_control.unavailable',
		);

		// Then the line's level and message are the ones given, and the event's other fields are kept
		const line = JSON.parse(written[0] ?? 'null') as Record<string, unknown>;
		assert.deepEqual(
			[line['level'], line['message'], line['reason']],
			['warn', 'access_control.unavailable', 'kept'],
		);
	});

	test('writes each line as one line, so a log collector never splits an event', () => {
		// Given the shim, and an event whose fields hold a line break
		const written: string[] = [];
		const logger = createBridgeLogger({ write: (line: string) => written.push(line) });

		// When the event is logged
		logger.info({ note: 'first\nsecond' }, 'access_control.permitted');

		// Then the written line holds no line break of its own
		assert.equal(written.length, 1);
		assert.equal(written[0]?.includes('\n'), false);
	});
});
