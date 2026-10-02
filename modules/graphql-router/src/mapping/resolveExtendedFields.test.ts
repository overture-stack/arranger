import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import type { ExtendedConfigs } from '@overture-stack/arranger-types/configs';

import { resolveExtendedFields } from './resolveExtendedFields.js';
import type { FieldFromMapping } from './types.js';

/**
 * Two different situations reach the same fallback today and produce the same sentence: a catalogue
 * configured without `extended.json`, which is supported, and a genuine failure to extend the
 * mapping, which is a fault. The first is raised as a thrown error purely as control flow, so an
 * operator reading the log cannot tell which happened, and the message describes neither.
 */
suite('resolveExtendedFields', () => {
	/**
	 * Fixtures carry only the properties each case is about. A fully-populated record would bury the
	 * one field under test, so they are narrowed here once rather than at every call.
	 */
	const mappingField = (entry: { fieldName: string; type: string }) => entry as unknown as FieldFromMapping;
	const fileEntries = (entries: Record<string, unknown>[]) => entries as unknown as ExtendedConfigs[];

	/** Not an array, so `extendFields` reaches `.find` on it and throws: the genuine-fault case. */
	const malformed = { notAnArray: true } as unknown as ExtendedConfigs[];

	const mappingFields = [mappingField({ fieldName: 'participants', type: 'nested' })];

	test('returns the extended fields when the configuration is present and extends cleanly', () => {
		const result = resolveExtendedFields({
			extendedConfigs: fileEntries([{ displayName: 'Participants', fieldName: 'participants' }]),
			label: 'clinical',
			mappingFields,
		});

		assert.equal(result[0]?.displayName, 'Participants');
		assert.equal(result[0]?.type, 'nested', 'the mapping still owns the type');
	});

	test('reports nothing at error level when the configuration extends cleanly', () => {
		const error = mock.method(console, 'error', () => {});

		try {
			resolveExtendedFields({
				extendedConfigs: fileEntries([{ displayName: 'Participants', fieldName: 'participants' }]),
				label: 'clinical',
				mappingFields,
			});

			assert.equal(error.mock.calls.length, 0);
		} finally {
			error.mock.restore();
		}
	});

	test('treats an absent configuration as supported, returning an empty list', () => {
		assert.deepEqual(resolveExtendedFields({ extendedConfigs: undefined, label: 'clinical', mappingFields }), []);
	});

	test('does not report an absent configuration as an error, because it is a valid deployment', () => {
		const error = mock.method(console, 'error', () => {});

		try {
			resolveExtendedFields({ extendedConfigs: undefined, label: 'clinical', mappingFields });

			assert.equal(
				error.mock.calls.length,
				0,
				'a catalogue with no extended.json is configured that way on purpose and must not read as a fault',
			);
		} finally {
			error.mock.restore();
		}
	});

	test('reports a genuine extension failure at error level, naming the catalogue', () => {
		const error = mock.method(console, 'error', () => {});

		try {
			resolveExtendedFields({ extendedConfigs: malformed, label: 'clinical', mappingFields });

			const messages = error.mock.calls.map((call) => String(call.arguments[0]));

			assert.ok(
				messages.some((message) => message.includes('clinical')),
				`expected an error naming the catalogue, got: ${JSON.stringify(messages)}`,
			);
		} finally {
			error.mock.restore();
		}
	});

	test('says what a failed extension costs, rather than only that it happened', () => {
		const error = mock.method(console, 'error', () => {});

		try {
			resolveExtendedFields({ extendedConfigs: malformed, label: 'clinical', mappingFields });

			const messages = error.mock.calls.map((call) => String(call.arguments[0])).join('\n');

			assert.match(
				messages,
				/facet|table|display/i,
				'an operator needs to know which surfaces degrade, not just that something failed',
			);
		} finally {
			error.mock.restore();
		}
	});

	test('names the GraphQL schema among what degrades, since isArray decides a field is [String] or String', () => {
		const error = mock.method(console, 'error', () => {});

		try {
			resolveExtendedFields({ extendedConfigs: malformed, label: 'clinical', mappingFields });

			const messages = error.mock.calls.map((call) => String(call.arguments[0])).join('\n');

			assert.match(
				messages,
				/schema/i,
				'an operator told only that display config degraded will not check whether their API surface changed shape',
			);
		} finally {
			error.mock.restore();
		}
	});

	test('still falls back rather than failing the catalogue, so a display-config fault does not stop startup', () => {
		assert.doesNotThrow(() => resolveExtendedFields({ extendedConfigs: malformed, label: 'clinical', mappingFields }));
	});
});
