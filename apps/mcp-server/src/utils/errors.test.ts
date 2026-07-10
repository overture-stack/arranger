import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { z as zod } from 'zod';

import { ArrangerRequestError } from '#arranger/client.js';
import { describeExecutionError, formatGraphQLError } from '#utils/errors.js';

suite('formatGraphQLError', () => {
	test('returns the bare message when no code or path is present', () => {
		assert.equal(formatGraphQLError({ message: 'Something went wrong' }), 'Something went wrong');
	});

	test('appends the extensions code and dotted path when present', () => {
		const formatted = formatGraphQLError({
			message: 'Field "name" is not defined',
			extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
			path: ['file', 'hits', 'edges'],
		});

		assert.equal(formatted, 'Field "name" is not defined [code: GRAPHQL_VALIDATION_FAILED] (at file.hits.edges)');
	});
});

suite('describeExecutionError', () => {
	test('explains a timeout and suggests narrowing the query', () => {
		const message = describeExecutionError(
			new ArrangerRequestError({ message: 'timed out', url: '/graphql', isTimeout: true }),
		);

		assert.match(message, /timed out/);
		assert.match(message, /reduce "first" or narrow the SQON/);
	});

	test('surfaces the HTTP status and the Arranger response body', () => {
		const message = describeExecutionError(
			new ArrangerRequestError({
				message: 'bad request',
				url: '/graphql',
				status: 400,
				statusText: 'Bad Request',
				body: '{"errors":[{"message":"Syntax Error"}]}',
			}),
		);

		assert.match(message, /HTTP 400 Bad Request/);
		assert.match(message, /\{"errors":\[\{"message":"Syntax Error"\}\]\}/);
	});

	test('truncates an oversized response body', () => {
		const message = describeExecutionError(
			new ArrangerRequestError({ message: 'bad request', url: '/graphql', status: 400, body: 'x'.repeat(600) }),
		);

		assert.match(message, /… \(truncated\)$/);
		assert.ok(!message.includes('x'.repeat(600)), 'expected the body to be capped before 600 characters');
	});

	test('falls back to an unreachable-server message when there is no status or timeout', () => {
		const message = describeExecutionError(
			new ArrangerRequestError({ message: 'connection refused', url: '/graphql' }),
		);

		assert.match(message, /Could not reach the Arranger server/);
	});

	test('flags an introspection schema mismatch as a version issue, not a query problem', () => {
		const { error } = zod.object({ catalogId: zod.string() }).safeParse({});
		assert.ok(error, 'expected the schema parse to fail');

		const message = describeExecutionError(error);

		assert.match(message, /did not match the expected introspection schema/);
		assert.match(message, /version mismatch/);
	});

	test('includes the message for an unrecognised error', () => {
		assert.equal(describeExecutionError(new Error('boom')), 'Unexpected error while executing the query: boom');
	});
});
