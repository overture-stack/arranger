import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import { logEvent, serializeError } from './logEvent.js';

const LEVELS = ['error', 'info', 'warn'] as const;

/** Runs `work` with the console's level methods captured, returning each call's method and arguments. */
const withConsoleCalls = (work: () => void): { args: unknown[]; method: string }[] => {
	const calls: { args: unknown[]; method: string }[] = [];
	const mocks = LEVELS.map((method) =>
		mock.method(console, method, (...args: unknown[]) => {
			calls.push({ args, method });
		}),
	);

	try {
		work();
		return calls;
	} finally {
		mocks.forEach((mocked) => mocked.mock.restore());
	}
};

const onlyLineOf = (calls: { args: unknown[]; method: string }[]): Record<string, unknown> => {
	assert.equal(calls.length, 1);
	const [{ args }] = calls as [{ args: unknown[]; method: string }];
	assert.equal(args.length, 1);
	assert.equal(typeof args[0], 'string');
	return JSON.parse(String(args[0])) as Record<string, unknown>;
};

suite('logEvent', () => {
	for (const level of LEVELS) {
		test(`writes a ${level} event as one JSON line with the console's ${level}`, () => {
			const calls = withConsoleCalls(() => logEvent(level, 'graphql.failed', { path: ['donor', 'hits'] }));

			assert.equal(calls[0]?.method, level);
			const { time, ...line } = onlyLineOf(calls);
			assert.deepEqual(line, { event: 'graphql.failed', level, path: ['donor', 'hits'] });
			assert.equal(new Date(String(time)).toISOString(), time);
		});
	}

	test('keeps its own event, level and time where a field has the same name', () => {
		const calls = withConsoleCalls(() =>
			logEvent('info', 'graphql.invalid_request', { event: 'forged', level: 'error', time: 'never' }),
		);

		const { event, level, time } = onlyLineOf(calls);
		assert.equal(event, 'graphql.invalid_request');
		assert.equal(level, 'info');
		assert.notEqual(time, 'never');
	});

	test('writes an error among the fields as its name and message, with no stack', () => {
		const calls = withConsoleCalls(() =>
			logEvent('error', 'access_enforcement.evaluation_failed', { cause: new TypeError('grants unreadable') }),
		);

		assert.deepEqual(onlyLineOf(calls)['cause'], { message: 'grants unreadable', name: 'TypeError' });
	});

	test('keeps the line, without its fields, where a field cannot be serialized', () => {
		const cycle: Record<string, unknown> = {};
		cycle['self'] = cycle;

		const calls = withConsoleCalls(() => logEvent('error', 'graphql.failed', { cycle }));

		const { time, ...line } = onlyLineOf(calls);
		assert.deepEqual(line, { event: 'graphql.failed', fieldsUnserializable: true, level: 'error' });
		assert.equal(new Date(String(time)).toISOString(), time);
	});
});

suite('serializeError', () => {
	test('serializes an error as its name and message, and its cause the same way', () => {
		const error = new Error('search failed', { cause: new RangeError('bound unparseable') });

		assert.deepEqual(serializeError(error), {
			cause: { message: 'bound unparseable', name: 'RangeError' },
			message: 'search failed',
			name: 'Error',
		});
	});

	test("keeps the error's stack, and not its cause's, when asked to", () => {
		const error = new Error('search failed', { cause: new Error('engine down') });

		const serialized = serializeError(error, { stack: true }) as Record<string, unknown>;

		assert.equal(serialized['stack'], error.stack);
		assert.equal((serialized['cause'] as Record<string, unknown>)['stack'], undefined);
	});

	test('ends a cause chain that cycles back on itself after five causes, marking it truncated', () => {
		const error = new Error('search failed');
		error.cause = error;

		const depthOf = (serialized: unknown): number => {
			const { cause, causeTruncated } = serialized as { cause?: unknown; causeTruncated?: true };
			assert.ok(cause !== undefined || causeTruncated === true);
			return cause === undefined ? 0 : 1 + depthOf(cause);
		};

		assert.equal(depthOf(serializeError(error)), 5);
	});

	test('keeps the line of an error whose cause cycles back on itself', () => {
		const error = new Error('search failed');
		error.cause = error;

		const calls = withConsoleCalls(() =>
			logEvent('error', 'graphql.failed', { error: serializeError(error, { stack: true }) }),
		);

		assert.equal((onlyLineOf(calls)['error'] as Record<string, unknown>)['message'], 'search failed');
	});

	test('returns a value that is not an error unchanged', () => {
		const thrown = { reason: 'not an error' };

		assert.equal(serializeError(thrown), thrown);
	});
});
