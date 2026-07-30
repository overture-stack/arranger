import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { buildGraphqlNameRegistry } from './graphqlNameRegistry.js';

// sanitizeGraphqlNameSegment/sanitizeGraphqlFlatName are tested in modules/types, where they live.

suite('buildGraphqlNameRegistry', () => {
	test('sanitizes the document type name', () => {
		const registry = buildGraphqlNameRegistry({ documentType: 'donor-1.0', fieldsFromMapping: [] });

		assert.equal(registry.documentType, 'donor_1_0');
	});

	test('maps a raw dotted path to its sanitized leaf name', () => {
		const registry = buildGraphqlNameRegistry({
			documentType: 'donor',
			fieldsFromMapping: [{ fieldName: 'biomarker.ca19-9_level' }],
		});

		assert.equal(registry.toGraphqlLeafName('biomarker.ca19-9_level'), 'ca19_9_level');
	});

	test('returns no collisions when every sibling sanitizes to a distinct name', () => {
		const registry = buildGraphqlNameRegistry({
			documentType: 'donor',
			fieldsFromMapping: [{ fieldName: 'biomarker.alc' }, { fieldName: 'biomarker.anc' }],
		});

		assert.deepEqual(registry.collisions, []);
	});

	test('reports a collision when two distinct raw siblings sanitize to the same name', () => {
		const registry = buildGraphqlNameRegistry({
			documentType: 'donor',
			fieldsFromMapping: [{ fieldName: 'biomarker.ca19-9_level' }, { fieldName: 'biomarker.ca19_9_level' }],
		});

		assert.equal(registry.collisions.length, 1);
		assert.equal(registry.collisions[0]?.graphqlName, 'ca19_9_level');
		assert.equal(registry.collisions[0]?.parentPath, 'biomarker');
		assert.deepEqual(
			registry.collisions[0]?.rawPaths.sort(),
			['biomarker.ca19-9_level', 'biomarker.ca19_9_level'].sort(),
		);
	});

	test('does not report a collision between fields under different parents, even with the same sanitized leaf', () => {
		const registry = buildGraphqlNameRegistry({
			documentType: 'donor',
			fieldsFromMapping: [{ fieldName: 'biomarker.status' }, { fieldName: 'treatment.status' }],
		});

		assert.deepEqual(registry.collisions, []);
	});

	test('falls back to sanitizing on the fly for a path not seen during construction', () => {
		const registry = buildGraphqlNameRegistry({ documentType: 'donor', fieldsFromMapping: [] });

		assert.equal(registry.toGraphqlLeafName('biomarker.ca19-9_level'), 'ca19_9_level');
	});

	test('exposes the same lookup as a plain, serializable object for worker-thread use', () => {
		const registry = buildGraphqlNameRegistry({
			documentType: 'donor',
			fieldsFromMapping: [{ fieldName: 'biomarker.ca19-9_level' }],
		});

		assert.deepEqual(registry.leafNamesByPath, { 'biomarker.ca19-9_level': 'ca19_9_level' });
	});
});
