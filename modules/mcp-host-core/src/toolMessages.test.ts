import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	capToolMessage,
	renderToolResult,
	TOOL_MESSAGES,
	type ToolCallOutcome,
	toolMessageFor,
} from './toolMessages.js';

const timing = { wireMs: 1, waitingMs: 0, rounds: 0 };

suite('toolMessageFor', () => {
	// Every row of the plan's tool-message table, and the unknown-tool and crossing rows this module adds.
	const rows: [ToolCallOutcome, string, boolean][] = [
		[{ outcome: 'result', result: { content: [{ type: 'text', text: 'ok' }] }, ...timing }, 'ok', false],
		[
			{ outcome: 'result', result: { content: [{ type: 'text', text: 'bad' }], isError: true }, ...timing },
			'bad',
			true,
		],
		[
			{ outcome: 'output_invalid', result: { content: [] }, message: 'count must be number', ...timing },
			TOOL_MESSAGES.outputInvalid,
			true,
		],
		[
			{ outcome: 'rejected', code: -32602, message: 'Unknown tool', ...timing },
			`${TOOL_MESSAGES.rejected}: Unknown tool`,
			true,
		],
		[
			{ outcome: 'input_state_rejected', message: 'invalid', waitedMs: 5, ...timing },
			TOOL_MESSAGES.inputStateRejected,
			true,
		],
		[
			{ outcome: 'input_failed', reason: 'resolver_error', message: 'x', ...timing },
			TOOL_MESSAGES.inputFailed,
			true,
		],
		[{ outcome: 'rounds_exceeded', maxRounds: 10, ...timing }, TOOL_MESSAGES.roundsExceeded, true],
		[{ outcome: 'cancelled', ...timing }, TOOL_MESSAGES.cancelled, true],
		[
			{ outcome: 'transport_error', kind: 'http', message: '500', status: 500, ...timing },
			TOOL_MESSAGES.transportError,
			true,
		],
		[{ outcome: 'denied', by: 'person' }, TOOL_MESSAGES.denied, true],
		[{ outcome: 'malformed' }, TOOL_MESSAGES.malformed, true],
		[{ outcome: 'unknown_tool' }, TOOL_MESSAGES.unknownTool, true],
		[{ outcome: 'not_run' }, TOOL_MESSAGES.notRun, true],
		[{ outcome: 'abandoned' }, TOOL_MESSAGES.abandoned, true],
		[
			{ outcome: 'crossing_refused', server: 'other', reason: 'this conversation holds signed-in data' },
			'Calls to server "other" are refused in this conversation: this conversation holds signed-in data',
			true,
		],
	];

	for (const [outcome, text, isError] of rows) {
		test(`writes the ${outcome.outcome} message`, () => {
			assert.deepEqual(toolMessageFor(outcome), { text, isError });
		});
	}
});

suite('renderToolResult', () => {
	test('joins text blocks and stands in for other content', () => {
		const text = renderToolResult({
			content: [
				{ type: 'text', text: 'a chart' },
				{ type: 'image', data: 'AAAA', mimeType: 'image/png' },
				{ type: 'resource', resource: { uri: 'test://r', text: 'inside' } },
				{ type: 'resource_link', uri: 'test://l', name: 'l' },
			],
		});

		assert.equal(text, 'a chart\n[image omitted]\n[resource omitted: test://r]\n[resource link: test://l]');
	});

	test('sends structured content only when there is no text', () => {
		assert.equal(renderToolResult({ content: [], structuredContent: { count: 3 } }), '{"count":3}');
		assert.equal(
			renderToolResult({ content: [{ type: 'text', text: 'three' }], structuredContent: { count: 3 } }),
			'three',
		);
	});
});

suite('capToolMessage', () => {
	test('cuts a long message and notes the cut', () => {
		assert.equal(capToolMessage('abcdef', 4), 'abcd\n[Result cut to 4 of 6 characters]');
	});

	test('leaves a short message, or one with no cap, alone', () => {
		assert.equal(capToolMessage('abc', 4), 'abc');
		assert.equal(capToolMessage('abcdef', undefined), 'abcdef');
	});
});
