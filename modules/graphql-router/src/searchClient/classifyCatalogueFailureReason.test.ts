import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	catalogueErrorCodes,
	classifyCatalogueFailureReason,
	NESTING_PREFIX_NOT_FOUND_ERROR_NAME,
	SCHEMA_BUILD_ERROR_NAME,
} from './classifyCatalogueFailureReason.js';

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

	test('classifies a 403 response error as permission_denied', () => {
		const searchClientError = Object.assign(new Error('Response Error'), {
			name: 'ResponseError',
			statusCode: 403,
		});

		const result = classifyCatalogueFailureReason(searchClientError);

		assert.equal(result.code, catalogueErrorCodes.PERMISSION_DENIED);
	});

	test('classifies a 401 response error as permission_denied', () => {
		const searchClientError = Object.assign(new Error('Response Error'), {
			name: 'ResponseError',
			statusCode: 401,
		});

		const result = classifyCatalogueFailureReason(searchClientError);

		assert.equal(result.code, catalogueErrorCodes.PERMISSION_DENIED);
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

	test('classifies an error marked as a schema build failure as schema_build_error, surfacing its own specific message', () => {
		const schemaBuildError = Object.assign(
			new Error('Invalid GraphQL name(s) found in this catalogue\'s mapping: `biomarkers.ca19-9_level`: ...'),
			{ name: SCHEMA_BUILD_ERROR_NAME },
		);
		const outer = new Error('Failed to initialize Arranger server', { cause: schemaBuildError });

		const result = classifyCatalogueFailureReason(outer);

		assert.equal(result.code, catalogueErrorCodes.SCHEMA_BUILD_ERROR);
		assert.equal(result.message, schemaBuildError.message);
	});

	test('classifies an error marked as a nesting-prefix mismatch as nesting_prefix_not_found, surfacing its own specific message', () => {
		const nestingPrefixError = Object.assign(new Error('Configured nestingPrefix "data" was not found in the index mapping.'), {
			name: NESTING_PREFIX_NOT_FOUND_ERROR_NAME,
		});
		const outer = new Error('Failed to initialize Arranger server', { cause: nestingPrefixError });

		const result = classifyCatalogueFailureReason(outer);

		assert.equal(result.code, catalogueErrorCodes.NESTING_PREFIX_NOT_FOUND);
		assert.equal(result.message, nestingPrefixError.message);
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
