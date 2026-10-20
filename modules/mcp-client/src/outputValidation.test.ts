import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type Tool } from '@modelcontextprotocol/client';

import {
	checkToolOutput,
	compileOutputValidators,
	MAX_OUTPUT_SCHEMA_BYTES,
	MAX_OUTPUT_SCHEMA_DEPTH,
} from './outputValidation.js';

const COUNT_SCHEMA = { type: 'object', properties: { count: { type: 'number' } }, required: ['count'] };

const tool = (name: string, outputSchema?: Record<string, unknown>) =>
	({ name, inputSchema: { type: 'object' }, ...(outputSchema && { outputSchema }) }) as Tool;

const result = (structuredContent?: unknown, isError?: boolean) => ({
	content: [],
	...(structuredContent !== undefined && { structuredContent: structuredContent as Record<string, unknown> }),
	...(isError !== undefined && { isError }),
});

/** A schema nested `levels` objects deep. */
const nested = (levels: number) => {
	let schema: Record<string, unknown> = { type: 'string' };
	for (let level = 0; level < levels; level += 1) {
		schema = { type: 'object', properties: { next: schema } };
	}
	return schema;
};

suite('output validation', () => {
	test('passes conforming structured content and reports content that does not conform', () => {
		const validators = compileOutputValidators([tool('count', COUNT_SCHEMA)]);

		assert.equal(checkToolOutput(validators, 'count', result({ count: 1 })), undefined);
		assert.match(checkToolOutput(validators, 'count', result({ count: 'one' })) ?? '', /does not match/);
	});

	test('requires structured content from a tool that declares an output schema, unless it reports an error', () => {
		const validators = compileOutputValidators([tool('count', COUNT_SCHEMA)]);

		assert.match(checkToolOutput(validators, 'count', result()) ?? '', /did not return structured content/);
		assert.equal(checkToolOutput(validators, 'count', result(undefined, true)), undefined);
	});

	test('checks nothing for a tool without an output schema, or one missing from the snapshot', () => {
		const validators = compileOutputValidators([tool('plain')]);

		assert.equal(validators.size, 0);
		assert.equal(checkToolOutput(validators, 'plain', result({ anything: true })), undefined);
		assert.equal(checkToolOutput(validators, 'unknown', result({ anything: true })), undefined);
	});

	test('fails every result of a tool whose output schema does not compile', () => {
		const validators = compileOutputValidators([
			tool('broken', { type: 'object', properties: { a: { type: 'nonsense' } } }),
		]);

		assert.match(checkToolOutput(validators, 'broken', result({ a: 1 })) ?? '', /invalid outputSchema/);
	});

	test('does not compile an output schema nested past the depth limit', () => {
		const validators = compileOutputValidators([tool('deep', nested(MAX_OUTPUT_SCHEMA_DEPTH))]);

		assert.match(checkToolOutput(validators, 'deep', result({})) ?? '', /nests deeper than/);
	});

	test('does not compile an output schema past the size limit', () => {
		const large = { type: 'object', description: 'x'.repeat(MAX_OUTPUT_SCHEMA_BYTES) };
		const validators = compileOutputValidators([tool('large', large)]);

		assert.match(checkToolOutput(validators, 'large', result({})) ?? '', /larger than/);
	});

	test('keeps each snapshot’s schemas apart, even when two share an $id', () => {
		const first = compileOutputValidators([tool('count', { ...COUNT_SCHEMA, $id: 'https://example.test/count' })]);
		const second = compileOutputValidators([
			tool('count', {
				$id: 'https://example.test/count',
				type: 'object',
				properties: { count: { type: 'string' } },
				required: ['count'],
			}),
		]);

		assert.equal(checkToolOutput(first, 'count', result({ count: 1 })), undefined);
		assert.equal(checkToolOutput(second, 'count', result({ count: 'one' })), undefined);
		assert.match(checkToolOutput(second, 'count', result({ count: 1 })) ?? '', /does not match/);
	});
});
