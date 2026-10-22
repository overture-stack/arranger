import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import getLegacyDateFieldNames from '#mapping/getLegacyDateFieldNames.js';

const LEGACY_PATTERN = 'yyyy-MM-dd HH:mm:ss.SSSSSS';

suite('getLegacyDateFieldNames', () => {
	test('names a date field whose format is the legacy pattern alone', () => {
		assert.deepEqual(getLegacyDateFieldNames({ diagnosed: { format: LEGACY_PATTERN, type: 'date' } }), [
			'diagnosed',
		]);
	});

	test('names a date field whose format holds the legacy pattern beside other alternatives', () => {
		// Given date fields whose formats hold the legacy pattern first, last, and among others
		const mapping = {
			collected: { format: `${LEGACY_PATTERN}||yyyy-MM-dd`, type: 'date' },
			diagnosed: { format: `${LEGACY_PATTERN}||yyyy-MM-dd HH:mm:ss`, type: 'date' },
			sequenced: { format: `yyyy-MM-dd||${LEGACY_PATTERN}`, type: 'date' },
			updated: { format: `epoch_millis||${LEGACY_PATTERN}||yyyy-MM-dd'T'HH:mm:ss`, type: 'date' },
		};

		// When the mapping is read, Then every one of them is named
		assert.deepEqual(getLegacyDateFieldNames(mapping).sort(), ['collected', 'diagnosed', 'sequenced', 'updated']);
	});

	test('names a date_nanos field whose format holds the legacy pattern', () => {
		assert.deepEqual(getLegacyDateFieldNames({ measured: { format: LEGACY_PATTERN, type: 'date_nanos' } }), [
			'measured',
		]);
	});

	test('leaves out a date field of the default format, or of a format holding another pattern', () => {
		// Given date fields with no format, the default one, and patterns that differ from the legacy one
		const mapping = {
			enrolled: { type: 'date' },
			registered: { format: 'strict_date_optional_time||epoch_millis', type: 'date' },
			released: { format: 'yyyy-MM-dd HH:mm:ss', type: 'date' },
			zoned: { format: `${LEGACY_PATTERN}XXX`, type: 'date' },
		};

		// When the mapping is read, Then none of them is named
		assert.deepEqual(getLegacyDateFieldNames(mapping), []);
	});

	test('leaves out a field that is not a date, whatever its other properties hold', () => {
		assert.deepEqual(getLegacyDateFieldNames({ label: { format: LEGACY_PATTERN, type: 'keyword' } }), []);
	});

	test('names each legacy-pattern date field by its full path, under objects and nested fields alike', () => {
		// Given legacy-pattern date fields at the root, under an object, under a nested field, and nested twice
		const mapping = {
			diagnosed: { format: LEGACY_PATTERN, type: 'date' },
			donor: {
				properties: {
					born: { format: LEGACY_PATTERN, type: 'date' },
					name: { type: 'keyword' },
				},
			},
			visits: {
				properties: {
					on: { format: `${LEGACY_PATTERN}||yyyy-MM-dd`, type: 'date' },
					samples: {
						properties: { taken: { format: LEGACY_PATTERN, type: 'date' } },
						type: 'nested',
					},
				},
				type: 'nested',
			},
		};

		// When the mapping is read, Then each is named by its full dotted path
		assert.deepEqual(getLegacyDateFieldNames(mapping).sort(), [
			'diagnosed',
			'donor.born',
			'visits.on',
			'visits.samples.taken',
		]);
	});

	test('names nothing for an absent mapping', () => {
		assert.deepEqual(getLegacyDateFieldNames(undefined), []);
	});
});
