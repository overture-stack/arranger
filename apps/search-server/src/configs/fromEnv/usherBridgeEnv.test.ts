import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import { readUsherBridgeEnv } from './usherBridgeEnv.js';

/** Every variable the bridge requires, set, so a test varies only the one it is about. */
const REQUIRED_ENV: NodeJS.ProcessEnv = {
	USHER_APPLICATION_KEY: 'application-key-k3',
	USHER_AUDIENCE: 'audience-a5',
	USHER_CONTROLLER_URL: 'http://controller.invalid',
	USHER_EVENT_SOURCE: 'event-source-e2',
	USHER_ISSUER: 'issuer-i9',
};

/** A malformed value no refusal's prose would hold by chance. */
const SENTINEL_LIMIT = 'clause-limit-sentinel-q7';

/** Reads `env` with refusals' log lines kept off the test output, returning what was read or the refusal. */
const readQuietly = (env: NodeJS.ProcessEnv): ReturnType<typeof readUsherBridgeEnv> | Error => {
	const logged = mock.method(console, 'error', () => undefined);

	try {
		return readUsherBridgeEnv(env);
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	} finally {
		logged.mock.restore();
	}
};

suite('the Usher bridge configuration read from the environment', () => {
	suite('ACCESS_CONTROL_FILTER_CLAUSE_LIMIT', () => {
		for (const [description, value] of [
			['unset', undefined],
			['blank', '   '],
		] as const) {
			test(`leaves the bridge its own clause limit when ${description}`, () => {
				const read = readQuietly({ ...REQUIRED_ENV, ACCESS_CONTROL_FILTER_CLAUSE_LIMIT: value });

				assert.ok(!(read instanceof Error), String(read));
				assert.equal(Object.hasOwn(read, 'filterClauseLimit'), false);
			});
		}

		test('passes a positive integer to the bridge as its clause limit, read without surrounding spaces', () => {
			const read = readQuietly({ ...REQUIRED_ENV, ACCESS_CONTROL_FILTER_CLAUSE_LIMIT: ' 4096 ' });

			assert.ok(!(read instanceof Error), String(read));
			assert.equal(read.filterClauseLimit, 4096);
		});

		for (const value of ['0', '-12', '1.5', '1e3', '0x400', '99999999999999999999', SENTINEL_LIMIT]) {
			test(`refuses startup given ${JSON.stringify(value)}, naming the variable and the rule but not the value`, () => {
				const read = readQuietly({ ...REQUIRED_ENV, ACCESS_CONTROL_FILTER_CLAUSE_LIMIT: value });

				assert.ok(read instanceof Error, 'expected a refusal');
				assert.match(read.message, /ACCESS_CONTROL_FILTER_CLAUSE_LIMIT is not a positive integer/);
				assert.equal(read.message.includes(SENTINEL_LIMIT), false, read.message);
			});
		}

		test('refuses a malformed limit together with every other variable at fault, in one refusal', () => {
			const { USHER_ISSUER: _issuer, ...withoutIssuer } = REQUIRED_ENV;
			const read = readQuietly({ ...withoutIssuer, ACCESS_CONTROL_FILTER_CLAUSE_LIMIT: '0' });

			assert.ok(read instanceof Error, 'expected a refusal');
			assert.match(read.message, /USHER_ISSUER is unset/);
			assert.match(read.message, /ACCESS_CONTROL_FILTER_CLAUSE_LIMIT is not a positive integer/);
		});
	});
});
