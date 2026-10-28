import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { estimateTokens, fitToWindow, requestCharacters, serverTruncated, shortenedResult } from './context.js';
import {
	assistantMessage,
	type ConversationItem,
	functionCall,
	functionCallOutput,
	isFunctionCallOutput,
	userMessage,
} from './messages.js';

/** A user question, then two earlier turns of one call each, then the latest turn's call (`call-3`). */
const conversation = (resultSize: number): ConversationItem[] => [
	userMessage('question'),
	functionCall({ callId: 'call-1', name: 'mcp__s__first', arguments: '{}' }),
	functionCallOutput('call-1', 'a'.repeat(resultSize), false),
	functionCall({ callId: 'call-2', name: 'mcp__s__second', arguments: '{}' }),
	functionCallOutput('call-2', 'b'.repeat(resultSize), false),
	functionCall({ callId: 'call-3', name: 'mcp__s__third', arguments: '{}' }),
	functionCallOutput('call-3', 'c'.repeat(resultSize), false),
];

suite('estimateTokens', () => {
	test('counts every character, plus the reply cap, without a baseline', () => {
		assert.equal(estimateTokens({ chars: 300, baseline: undefined, charsPerToken: 3, maxOutputTokens: 50 }), 150);
	});

	test("starts from the previous turn's counted prompt", () => {
		const baseline = { inputTokens: 1_000, sentChars: 900, shortened: [] };
		assert.equal(estimateTokens({ chars: 1_200, baseline, charsPerToken: 3, maxOutputTokens: 50 }), 1_150);
	});
});

suite('requestCharacters', () => {
	test("counts an assistant turn's reasoning only when the provider sends it back", () => {
		const items = [userMessage('q'), assistantMessage('a', { reasoning: 'r'.repeat(1_000) })];
		const without = requestCharacters('', [], items);
		assert.equal(requestCharacters('', [], items, true), without + 1_000);
	});
});

suite('fitToWindow', () => {
	const settings = {
		systemPrompt: 'sys',
		tools: [],
		baseline: undefined,
		maxOutputTokens: 100,
		latestCalls: new Set(['call-3']),
	};

	test('sends the conversation unchanged when it fits', () => {
		const items = conversation(10);
		const fitted = fitToWindow({ ...settings, items, window: { tokens: 10_000, policy: 'shorten' } });

		assert.equal(fitted.fits, true);
		assert.deepEqual(fitted.items, items);
		assert.deepEqual(fitted.shortened, []);
	});

	test('shortens the oldest results first, and never the latest turn or the question', () => {
		const items = conversation(3_000);
		const full = requestCharacters('sys', [], items);
		// Room for everything but one earlier result.
		const tokens = Math.ceil((full - 2_500) / 3) + 100;
		const fitted = fitToWindow({ ...settings, items, window: { tokens, policy: 'shorten', charsPerToken: 3 } });

		assert.equal(fitted.fits, true);
		assert.deepEqual(fitted.shortened, [{ callId: 'call-1', name: 'mcp__s__first' }]);
		assert.equal(
			fitted.items[2]?.type === 'function_call_output' && fitted.items[2].output,
			shortenedResult('mcp__s__first'),
		);
		assert.deepEqual(fitted.items.slice(3), items.slice(3));
		assert.ok(fitted.estimateAfter < fitted.estimateBefore);
		assert.equal(
			items[2]?.type === 'function_call_output' && items[2].output.length,
			3_000,
			'the conversation is not changed',
		);
	});

	test('reports that it cannot fit once only the latest turn is left', () => {
		const items = conversation(3_000);
		const fitted = fitToWindow({
			...settings,
			items,
			window: { tokens: 1_000, policy: 'shorten', charsPerToken: 3 },
		});

		assert.equal(fitted.fits, false);
		assert.deepEqual(
			fitted.shortened.map(({ callId }) => callId),
			['call-1', 'call-2'],
		);
		const latest = fitted.items.filter(isFunctionCallOutput).at(-1);
		assert.equal(latest?.output.length, 3_000);
	});

	test('may shorten every result once a new question starts a run', () => {
		const items = [...conversation(3_000), assistantMessage('answer'), userMessage('next')];
		const fitted = fitToWindow({
			...settings,
			items,
			latestCalls: new Set(),
			window: { tokens: 1_000, policy: 'shorten', charsPerToken: 3 },
		});

		assert.deepEqual(
			fitted.shortened.map(({ callId }) => callId),
			['call-1', 'call-2', 'call-3'],
		);
	});

	test('shortens nothing under the fail policy', () => {
		const items = conversation(3_000);
		const fitted = fitToWindow({ ...settings, items, window: { tokens: 1_000, policy: 'fail' } });

		assert.equal(fitted.fits, false);
		assert.deepEqual(fitted.shortened, []);
		assert.deepEqual(fitted.items, items);
	});
});

suite('serverTruncated', () => {
	const baseline = { inputTokens: 3_562, sentChars: 10_000, shortened: [] };

	test('flags a longer request counted at fewer tokens, as Phase 0 saw', () => {
		assert.equal(serverTruncated(baseline, { inputTokens: 3_494, sentChars: 14_000, shortened: [] }), true);
	});

	test('accepts a count that grew', () => {
		assert.equal(serverTruncated(baseline, { inputTokens: 4_800, sentChars: 14_000, shortened: [] }), false);
	});

	test('ignores a request that was shortened differently, or did not grow', () => {
		assert.equal(
			serverTruncated(baseline, { inputTokens: 3_000, sentChars: 14_000, shortened: ['call-1'] }),
			false,
		);
		assert.equal(serverTruncated(baseline, { inputTokens: 3_562, sentChars: 10_000, shortened: [] }), false);
		assert.equal(serverTruncated(undefined, { inputTokens: 1, sentChars: 14_000, shortened: [] }), false);
	});
});
