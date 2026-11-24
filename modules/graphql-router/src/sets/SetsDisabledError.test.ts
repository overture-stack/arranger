import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	isSetsDisabledError,
	SETS_DISABLED_MESSAGE,
	SETS_UNAVAILABLE_MESSAGE,
	SetsDisabledError,
} from './SetsDisabledError.js';

suite('SetsDisabledError', () => {
	test('answers the disabled message where saved sets are not enabled on the server', () => {
		assert.equal(new SetsDisabledError().message, 'Saved sets are not enabled on this server.');
		assert.equal(new SetsDisabledError().message, SETS_DISABLED_MESSAGE);
	});

	test('answers the unavailable message where saved sets are enabled but the catalogue has no usable sets index', () => {
		assert.equal(
			new SetsDisabledError({ unavailable: true }).message,
			'Saved sets are unavailable on this server.',
		);
		assert.equal(new SetsDisabledError({ unavailable: true }).message, SETS_UNAVAILABLE_MESSAGE);
	});

	test('is recognized by its name under both messages, sharing the one code', () => {
		assert.equal(isSetsDisabledError(new SetsDisabledError()), true);
		assert.equal(isSetsDisabledError(new SetsDisabledError({ unavailable: true })), true);
		assert.equal(isSetsDisabledError(new Error('Saved sets are unavailable on this server.')), false);
	});
});
