import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import type { ExtendedConfigs } from '@overture-stack/arranger-types/configs';

import { extendFacets, extendFields } from './extendMapping.js';
import type { FieldFromMapping } from './types.js';

suite('extendFacets', () => {
	test('matches a facets.json entry against extended fields by its raw dotted path', () => {
		const result = extendFacets(
			{ aggregations: [{ fieldName: 'biomarker.ca19-9_level' }] },
			[{ displayName: 'CA19-9 Level', displayType: 'keyword', fieldName: 'biomarker.ca19-9_level' }],
		);

		assert.equal(result.aggregations?.[0]?.displayName, 'CA19-9 Level');
	});

	test('still matches a facets.json entry written in the legacy __-escaped form', () => {
		const result = extendFacets(
			{ aggregations: [{ fieldName: 'biomarker__ca19-9_level' }] },
			[{ displayName: 'CA19-9 Level', displayType: 'keyword', fieldName: 'biomarker.ca19-9_level' }],
		);

		assert.equal(result.aggregations?.[0]?.displayName, 'CA19-9 Level');
	});

	test('sanitizes hyphens (not just dots) in the auto-generated default aggregations fieldName', () => {
		const result = extendFacets({ aggregations: [] }, [
			{ displayName: 'CA19-9 Level', displayType: 'keyword', fieldName: 'biomarker.ca19-9_level' },
		]);

		assert.equal(result.aggregations?.[0]?.fieldName, 'biomarker__ca19_9_level');
	});
});

/**
 * A field's `type` is the index mapping's to state. Elasticsearch decides storage from it, and
 * `nested` in particular changes how a filter has to be compiled, so a configuration file cannot be
 * allowed to contradict it. `extendFields` already takes `type` from the mapping and never from the
 * file; these pin that and add the warning that tells an operator their declaration does nothing.
 */
suite('extendFields', () => {
	/**
	 * Fixtures carry only the properties each case is about, and a file entry declaring a `type` is
	 * deliberately invalid: that declaration is the input under test. Narrowed here once rather than
	 * at every call.
	 */
	const mappingFields = (entries: { fieldName: string; type: string }[]) => entries as unknown as FieldFromMapping[];
	const fileEntries = (entries: Record<string, unknown>[]) => entries as unknown as ExtendedConfigs[];

	test('takes `type` from the mapping', () => {
		const [field] = extendFields(mappingFields([{ fieldName: 'participants', type: 'nested' }]), []);

		assert.equal(field?.type, 'nested');
	});

	test('ignores a `type` declared in the extended config file, keeping the mapping value', () => {
		const [field] = extendFields(
			mappingFields([{ fieldName: 'participants', type: 'nested' }]),
			fileEntries([{ fieldName: 'participants', type: 'keyword' }]),
		);

		assert.equal(
			field?.type,
			'nested',
			'a file-declared type must not override the mapping, or a nested field compiles as flat',
		);
	});

	test('still applies the display properties from a file entry that also declares a type', () => {
		const [field] = extendFields(
			mappingFields([{ fieldName: 'participants', type: 'nested' }]),
			fileEntries([{ displayName: 'Participants', fieldName: 'participants', type: 'keyword' }]),
		);

		assert.equal(field?.displayName, 'Participants', 'an ignored type must not discard the rest of the entry');
	});

	test('warns that a file-declared type is ignored, naming the field', () => {
		const warn = mock.method(console, 'warn', () => {});

		try {
			extendFields(
				mappingFields([{ fieldName: 'participants', type: 'nested' }]),
				fileEntries([{ fieldName: 'participants', type: 'keyword' }]),
			);

			const messages = warn.mock.calls.map((call) => String(call.arguments[0]));

			assert.ok(
				messages.some((message) => message.includes('participants')),
				`expected a warning naming the field, got: ${JSON.stringify(messages)}`,
			);
		} finally {
			warn.mock.restore();
		}
	});

	test('reports once for the catalogue, naming every field, rather than once per field', () => {
		const warn = mock.method(console, 'warn', () => {});

		try {
			extendFields(
				mappingFields([
					{ fieldName: 'participants', type: 'nested' },
					{ fieldName: 'donors', type: 'nested' },
				]),
				fileEntries([
					{ fieldName: 'participants', type: 'keyword' },
					{ fieldName: 'donors', type: 'keyword' },
				]),
			);

			assert.equal(
				warn.mock.calls.length,
				1,
				'the fix is one edit to one file, so a per-field warning multiplies noise without adding an action',
			);

			const message = warn.mock.calls.map((call) => String(call.arguments[0])).join('\n');

			assert.match(message, /participants/);
			assert.match(message, /donors/);
		} finally {
			warn.mock.restore();
		}
	});

	test('stays silent when no file entry declares a type', () => {
		const warn = mock.method(console, 'warn', () => {});

		try {
			extendFields(
				mappingFields([{ fieldName: 'participants', type: 'nested' }]),
				fileEntries([{ displayName: 'Participants', fieldName: 'participants' }]),
			);

			assert.equal(warn.mock.calls.length, 0, 'the ordinary case must not train operators to ignore warnings');
		} finally {
			warn.mock.restore();
		}
	});
});
