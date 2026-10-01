import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import * as packageRoot from '#index.js';

suite('the package root', () => {
	test('exports AccessControlError, the class an export refused for access control rejects with', async () => {
		// Given the class as the package root exports it
		const { AccessControlError } = packageRoot;
		assert.equal(typeof AccessControlError, 'function');

		// When an export starts on a context no router built, passing no filter of its own
		const refusal = await packageRoot.utils.getAllData({ ctx: {}, sqon: null }).then(
			() => undefined,
			(error: unknown) => error,
		);

		// Then it rejects with an instance of that very class
		assert.ok(refusal instanceof AccessControlError, String(refusal));
	});
});
