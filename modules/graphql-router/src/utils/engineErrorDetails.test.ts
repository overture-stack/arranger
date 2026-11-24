import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { engineErrorDetailsOf } from './engineErrorDetails.js';

/** A failed request shaped as the engine client's ResponseError is, with the given `meta`. */
const responseErrorWith = (meta: Record<string, unknown>) => Object.assign(new Error('Response Error'), { meta });

suite('engineErrorDetailsOf', () => {
	test('gives the status code alone when the response has no body', () => {
		// Given a refused request whose response carries a 403 and no body
		const error = responseErrorWith({ statusCode: 403 });

		// When its details are read, Then only the status code is given
		assert.deepEqual(engineErrorDetailsOf(error), { statusCode: 403 });
	});

	test('gives the status code and the engine error type when the body names one', () => {
		// Given a refused request whose body names a security exception
		const error = responseErrorWith({
			body: { error: { type: 'security_exception' }, status: 403 },
			statusCode: 403,
		});

		// When its details are read, Then both the status code and the error type are given
		assert.deepEqual(engineErrorDetailsOf(error), { errorType: 'security_exception', statusCode: 403 });
	});

	test('never gives the error reason, even when the body holds one', () => {
		// Given a refused request whose body names the user and roles in its reason and root causes
		const error = responseErrorWith({
			body: {
				error: {
					reason: 'action [indices:admin/exists] is unauthorized for user [jane] with roles [reader]',
					root_cause: [{ reason: 'unauthorized for user [jane]', type: 'security_exception' }],
					type: 'security_exception',
				},
			},
			statusCode: 403,
		});

		// When its details are read, Then the output holds no trace of the reason
		const details = JSON.stringify(engineErrorDetailsOf(error));
		assert.equal(details.includes('jane'), false);
		assert.equal(details.includes('reader'), false);
		assert.equal(details.includes('reason'), false);
		assert.deepEqual(engineErrorDetailsOf(error), { errorType: 'security_exception', statusCode: 403 });
	});

	test('gives nothing for a plain Error', () => {
		// Given a plain Error, which carries no engine metadata
		const error = new Error('connect ECONNREFUSED');

		// When its details are read, Then nothing is given
		assert.deepEqual(engineErrorDetailsOf(error), {});
	});

	test('gives nothing for a string, null or undefined, and does not throw', () => {
		// Given values thrown as strings, null and undefined
		// When their details are read, Then nothing is given and nothing is thrown
		assert.deepEqual(engineErrorDetailsOf('Response Error'), {});
		assert.deepEqual(engineErrorDetailsOf(null), {});
		assert.deepEqual(engineErrorDetailsOf(undefined), {});
	});

	test('gives nothing for a non-numeric status code, and does not throw', () => {
		// Given a request whose status code is a string rather than a number
		const error = responseErrorWith({ statusCode: '403' });

		// When its details are read, Then the status code is left out
		assert.deepEqual(engineErrorDetailsOf(error), {});
	});

	test('gives nothing for an error whose metadata getter throws, and does not throw', () => {
		// Given an error whose metadata cannot be read
		const error = {
			get meta(): never {
				throw new Error('unreadable');
			},
		};

		// When its details are read, Then nothing is given and nothing is thrown
		assert.deepEqual(engineErrorDetailsOf(error), {});
	});
});
