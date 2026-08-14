import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { catalogueErrorCodes } from '@overture-stack/arranger-graphql-router';

import { computeAggregateServerStatus } from './computeAggregateServerStatus.js';
import { serverAggregateStatuses } from './types.js';

suite('computeAggregateServerStatus', () => {
	test('is healthy when every catalogue is available', () => {
		const result = computeAggregateServerStatus({
			a: { status: 'available' },
			b: { status: 'available' },
		});

		assert.equal(result, serverAggregateStatuses.HEALTHY);
	});

	test('is degraded when some catalogues are available and some have failed', () => {
		const result = computeAggregateServerStatus({
			available: { status: 'available' },
			broken1: { status: 'failed', error: { code: catalogueErrorCodes.INDEX_NOT_FOUND, message: 'x' } },
			broken2: { status: 'failed', error: { code: catalogueErrorCodes.INDEX_NOT_FOUND, message: 'x' } },
			broken3: { status: 'failed', error: { code: catalogueErrorCodes.INDEX_NOT_FOUND, message: 'x' } },
			broken4: { status: 'failed', error: { code: catalogueErrorCodes.INDEX_NOT_FOUND, message: 'x' } },
		});

		assert.equal(result, serverAggregateStatuses.DEGRADED);
	});

	test('is unhealthy when every catalogue has failed', () => {
		const result = computeAggregateServerStatus({
			a: { status: 'failed', error: { code: catalogueErrorCodes.CONNECTION_ERROR, message: 'x' } },
			b: { status: 'failed', error: { code: catalogueErrorCodes.CONNECTION_ERROR, message: 'x' } },
		});

		assert.equal(result, serverAggregateStatuses.UNHEALTHY);
	});

	test('is healthy for an empty set of catalogues (nothing has failed)', () => {
		const result = computeAggregateServerStatus({});

		assert.equal(result, serverAggregateStatuses.HEALTHY);
	});
});
