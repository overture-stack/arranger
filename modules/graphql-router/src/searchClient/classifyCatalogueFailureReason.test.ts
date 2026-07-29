import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { catalogueErrorCodes, classifyCatalogueFailureReason } from './classifyCatalogueFailureReason.js';

suite('classifyCatalogueFailureReason', () => {
	test('classifies a 404 response error as index_not_found', () => {
		const searchClientError = Object.assign(new Error('Response Error'), {
			name: 'ResponseError',
			statusCode: 404,
		});
		const wrapped = new Error('Could not create a mapping', { cause: searchClientError });
		const outer = new Error('Failed to initialize Arranger server', { cause: wrapped });

		const result = classifyCatalogueFailureReason(outer);

		assert.equal(result.code, catalogueErrorCodes.INDEX_NOT_FOUND);
	});

	test('classifies a connection error as connection_error', () => {
		const searchClientError = Object.assign(new Error('connect ECONNREFUSED'), {
			name: 'ConnectionError',
		});
		const wrapped = new Error('Could not create a mapping', { cause: searchClientError });

		const result = classifyCatalogueFailureReason(wrapped);

		assert.equal(result.code, catalogueErrorCodes.CONNECTION_ERROR);
	});

	test('classifies a timeout error as connection_error', () => {
		const searchClientError = Object.assign(new Error('Timeout'), { name: 'TimeoutError' });

		const result = classifyCatalogueFailureReason(searchClientError);

		assert.equal(result.code, catalogueErrorCodes.CONNECTION_ERROR);
	});

	test('classifies a search-engine error with no matching code as mapping_fetch_error', () => {
		const searchClientError = Object.assign(new Error('Serialization failed'), {
			name: 'SerializationError',
			statusCode: 500,
		});

		const result = classifyCatalogueFailureReason(searchClientError);

		assert.equal(result.code, catalogueErrorCodes.MAPPING_FETCH_ERROR);
	});

	test('classifies an error with no identifiable cause as unknown_error', () => {
		const result = classifyCatalogueFailureReason(new Error('Something else went wrong entirely'));

		assert.equal(result.code, catalogueErrorCodes.UNKNOWN_ERROR);
	});

	test('never surfaces the raw underlying error message in the default (non-debug) message', () => {
		const searchClientError = Object.assign(new Error('connect ECONNREFUSED 10.0.4.221:9200'), {
			name: 'ConnectionError',
		});

		const result = classifyCatalogueFailureReason(searchClientError);

		assert.ok(!result.message.includes('10.0.4.221'));
	});
});
