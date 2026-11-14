import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type FinalResponse } from './provider.js';
import { decideReply } from './reply.js';

const ALLOWED = { emptyReply: true, outputLimit: true };
const OFF = { emptyReply: false, outputLimit: false };

const reply = (text: string, stopReason: FinalResponse['stopReason'] = 'stop', toolCalls = false) => ({
	text,
	stopReason,
	toolCalls: toolCalls ? [{ kind: 'call' as const, name: 'mcp__s__a', arguments: '{}' }] : [],
});

suite('decideReply', () => {
	test('runs tool calls, whatever else the reply holds', () => {
		assert.deepEqual(decideReply(reply('', 'length', true), 'output_limit', OFF), { kind: 'tool_calls' });
	});

	test('keeps a text answer', () => {
		assert.deepEqual(decideReply(reply('Done.'), undefined, ALLOWED), { kind: 'answered' });
	});

	test('treats whitespace as no text', () => {
		assert.deepEqual(decideReply(reply(' \n'), undefined, ALLOWED), { kind: 'empty_reply', retry: true });
	});

	test('retries a reply cut off with no text once, and never one with visible text', () => {
		assert.deepEqual(decideReply(reply('', 'length'), undefined, ALLOWED), {
			kind: 'output_limit',
			keepText: false,
			retry: true,
		});
		assert.deepEqual(decideReply(reply('Partial', 'length'), undefined, ALLOWED), {
			kind: 'output_limit',
			keepText: true,
			retry: false,
		});
	});

	test('retries nothing the consumer turned off', () => {
		assert.deepEqual(decideReply(reply('', 'length'), undefined, OFF), {
			kind: 'output_limit',
			keepText: false,
			retry: false,
		});
		assert.deepEqual(decideReply(reply(''), undefined, OFF), { kind: 'empty_reply', retry: false });
	});

	test('never retries a reply to a retry, of either kind', () => {
		for (const previous of ['empty_reply', 'output_limit'] as const) {
			assert.deepEqual(
				decideReply(reply('', 'length'), previous, ALLOWED),
				{ kind: 'output_limit', keepText: false, retry: false },
				`cut off after a ${previous} retry`,
			);
			assert.deepEqual(
				decideReply(reply(''), previous, ALLOWED),
				{ kind: 'empty_reply', retry: false },
				`empty after a ${previous} retry`,
			);
		}
	});
});
