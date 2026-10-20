import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { ProtocolError, SdkError, SdkErrorCode, SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client';

import { classifyError, type ClassifyContext } from './outcomes.js';

const firstLeg: ClassifyContext = { aborted: false, carriedRequestState: false, waitedMs: 0 };
const retryLeg: ClassifyContext = { aborted: false, carriedRequestState: true, waitedMs: 1_234 };

const refusedState = () =>
	new ProtocolError(-32602, 'Invalid or expired requestState', { reason: 'invalid_request_state' });

suite('classifyError', () => {
	test('reports the caller’s own abort as cancelled, whatever the SDK threw', () => {
		const error = new SdkError(SdkErrorCode.RequestTimeout, 'This operation was aborted');

		assert.deepEqual(classifyError(error, { ...firstLeg, aborted: true }), { outcome: 'cancelled' });
	});

	test('reports a timeout without an abort as a transport error', () => {
		const error = new SdkError(SdkErrorCode.RequestTimeout, 'Request timed out', { timeout: 100 });

		assert.deepEqual(classifyError(error, firstLeg), {
			outcome: 'transport_error',
			kind: 'timeout',
			message: 'Request timed out',
			sdkCode: SdkErrorCode.RequestTimeout,
		});
	});

	test('reports a refused state only on a leg that echoed one', () => {
		assert.deepEqual(classifyError(refusedState(), retryLeg), {
			outcome: 'input_state_rejected',
			message: 'Invalid or expired requestState',
			waitedMs: 1_234,
		});
		assert.equal(classifyError(refusedState(), firstLeg).outcome, 'rejected');
	});

	test('reports other JSON-RPC errors as rejected, with their code and data', () => {
		const error = new ProtocolError(-32602, 'Tool nope not found', { detail: 1 });

		assert.deepEqual(classifyError(error, retryLeg), {
			outcome: 'rejected',
			code: -32602,
			message: 'Tool nope not found',
			data: { detail: 1 },
		});
	});

	test('names the HTTP status of a failed request', () => {
		const error = new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, 'Error POSTing to endpoint', {
			status: 503,
			statusText: 'Service Unavailable',
		});

		const outcome = classifyError(error, firstLeg);

		assert.equal(outcome.outcome, 'transport_error');
		assert.equal(outcome.kind, 'http');
		assert.equal(outcome.status, 503);
	});

	test('reports authentication failures as unauthorized', () => {
		const failedRetry = new SdkHttpError(
			SdkErrorCode.ClientHttpAuthentication,
			'Server returned 401 after re-authentication',
			{
				status: 401,
			},
		);

		assert.equal(classifyError(new UnauthorizedError(), firstLeg).outcome, 'transport_error');
		assert.equal((classifyError(new UnauthorizedError(), firstLeg) as { kind: string }).kind, 'unauthorized');
		assert.equal((classifyError(failedRetry, firstLeg) as { kind: string }).kind, 'unauthorized');
	});

	test('reports a failed fetch, which the SDK does not wrap, as a network error', () => {
		const outcome = classifyError(new TypeError('fetch failed'), firstLeg);

		assert.equal(outcome.outcome, 'transport_error');
		assert.equal(outcome.kind, 'network');
	});

	test('reports a reply that fails the wire codec as an invalid result', () => {
		const outcome = classifyError(new SdkError(SdkErrorCode.InvalidResult, 'bad result'), firstLeg);

		assert.equal(outcome.outcome, 'transport_error');
		assert.equal(outcome.kind, 'invalid_result');
	});
});
