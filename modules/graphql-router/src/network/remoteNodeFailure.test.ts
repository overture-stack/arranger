import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { AxiosError, AxiosHeaders, CanceledError } from 'axios';

import { REMOTE_NODE_FAILURE_TEXTS, remoteNodeFailureKindOf } from './remoteNodeFailure.js';

const REMOTE_URL = 'http://10.0.0.7:5050/graphql';
const REMOTE_DETAIL = 'index [donor_internal_7] is closed';

/** An error as axios rejects a request with, holding the request it made and, where one came back, the answer. */
const axiosErrorFor = ({ code, data, status }: { code?: string; data?: unknown; status?: number }): AxiosError => {
	const config = { headers: new AxiosHeaders(), url: REMOTE_URL };

	return new AxiosError(
		status ? `Request failed with status code ${status}` : `connect ${code} 10.0.0.7:5050`,
		code,
		config,
		{},
		status ? { config, data, headers: {}, status, statusText: 'Bad Request' } : undefined,
	);
};

suite('remoteNodeFailureKindOf', () => {
	test('names a connection the remote refused as the node being unreachable', () => {
		assert.equal(remoteNodeFailureKindOf(axiosErrorFor({ code: 'ECONNREFUSED' })), 'unreachable');
	});

	test('names a host that does not resolve as the node being unreachable', () => {
		assert.equal(remoteNodeFailureKindOf(axiosErrorFor({ code: 'ENOTFOUND' })), 'unreachable');
	});

	test('names a request cancelled before the node answered as cancelled', () => {
		assert.equal(remoteNodeFailureKindOf(new CanceledError('signal is aborted without reason')), 'cancelled');
	});

	test('names an answer carrying an error status as the node answering with errors', () => {
		const failures = [
			axiosErrorFor({ data: { errors: [{ message: REMOTE_DETAIL }] }, status: 400 }),
			axiosErrorFor({ data: 'Bad Gateway', status: 502 }),
		];

		failures.forEach((failure) => assert.equal(remoteNodeFailureKindOf(failure), 'errors'));
	});

	test('leaves any error axios did not raise to its caller', () => {
		assert.equal(remoteNodeFailureKindOf(new TypeError(REMOTE_DETAIL)), undefined);
		assert.equal(remoteNodeFailureKindOf(undefined), undefined);
	});
});

suite('REMOTE_NODE_FAILURE_TEXTS', () => {
	test('names each kind of problem in its own fixed text', () => {
		assert.deepEqual(REMOTE_NODE_FAILURE_TEXTS, {
			cancelled: 'The request to this node was cancelled before it answered.',
			errors: 'This node answered the request with errors.',
			unreachable: 'This node could not be reached.',
			unreadable: 'This node answered with data this server cannot read.',
		});
	});
});
