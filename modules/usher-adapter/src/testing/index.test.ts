import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

suite("the testing module's surface", () => {
	test('exports exactly these runtime values', async () => {
		assert.deepEqual(Object.keys(await import('./index.js')).toSorted(), [
			'ABSENT_CATEGORIES_REGISTRATION',
			'ABSENT_CATEGORIES_UNMARKED',
			'ANONYMOUS',
			'CATEGORY_CONDITIONS',
			'CATEGORY_FIELD',
			'CONTROLLED_ONLY_ANONYMOUS',
			'CONTROLLED_ONLY_REGISTRATION',
			'DENIAL_KINDS',
			'DENIED_ERROR_NAME',
			'DENY_REASONS',
			'EMPTY_LIST_REGISTRATION',
			'EVENTS',
			'EVERY_RECORD',
			'INDEX_MAPPING',
			'OPEN_REGISTRATION',
			'RECORDS',
			'RECORDS_REGISTRATION',
			'RESOURCE_CATEGORY_REGISTRATION',
			'RESOURCE_FIELD',
			'ROWS',
			'SUSPENDED',
			'UNAVAILABLE_ERROR_NAME',
			'UNAVAILABLE_GRAPHQL_CODE',
			'accessOf',
			'categoryCondition',
			'createFakeBridge',
			'createRecordingLogger',
			'createStubProbe',
			'denialAnswerFor',
			'isConfigurationRefusal',
			'signedIn',
			'suspendedConfirmed',
		]);
	});
});
