import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { tableDefaults } from '@overture-stack/arranger-types/configs/constants';

import { applyResultsWindow } from './resolveHits.js';

suite('applyResultsWindow', () => {
	test('returns first when it is within the configured results window', () => {
		assert.equal(applyResultsWindow(100, 10000), 100);
	});

	test('caps at maxResultsWindow when first exceeds it', () => {
		assert.equal(applyResultsWindow(20000, 10000), 10000);
	});

	test('respects a per-catalogue window smaller than the requested size', () => {
		assert.equal(applyResultsWindow(1000, 500), 500);
	});

	test('falls back to tableDefaults.MAX_RESULTS_WINDOW when maxResultsWindow is undefined', () => {
		assert.equal(applyResultsWindow(5000, undefined), 5000);
		assert.equal(applyResultsWindow(20000, undefined), tableDefaults.MAX_RESULTS_WINDOW);
	});

	test('returns 0 when first is 0', () => {
		assert.equal(applyResultsWindow(0, 10000), 0);
	});
});
