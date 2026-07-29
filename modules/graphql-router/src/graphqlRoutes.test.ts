import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { FALLBACK_LABEL, isFallbackLabel } from './graphqlRoutes.js';

suite('isFallbackLabel', () => {
	test('returns true for the fallback label', () => {
		assert.equal(isFallbackLabel(FALLBACK_LABEL), true);
	});

	test('returns false for a real catalogue label', () => {
		assert.equal(isFallbackLabel('donor'), false);
	});

	test('returns false when no label is given', () => {
		assert.equal(isFallbackLabel(undefined), false);
	});
});
