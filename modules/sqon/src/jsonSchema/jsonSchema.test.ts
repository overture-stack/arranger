import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { suite, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { getSqonJsonSchema, getVersionedSqonJsonSchema } from '#jsonSchema/index.js';
import { SQON_SCHEMA_VERSION } from '#version/index.js';

suite('sqon/jsonSchema', () => {
	test('uses package version for SQON schema version', () => {
		const currentDir = path.dirname(fileURLToPath(import.meta.url));
		const packageJsonPath = path.resolve(currentDir, '../../package.json');
		const packageJson: { version: string } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

		assert.equal(SQON_SCHEMA_VERSION, packageJson?.version);
	});

	test('returns a baseline JSON Schema payload', () => {
		const schema = getSqonJsonSchema();

		assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
		assert.equal(schema.title, 'Serialized Query Object Notation');
		assert.equal(schema.$ref, '#/$defs/SQON');
		assert.ok(schema.$defs);
		assert.ok(schema.$defs.SQON);
		assert.ok(schema.$defs.Group);
		assert.ok(schema.$defs.Leaf);
		assert.ok(schema.$defs.InLike);
		assert.ok(schema.$defs.RangeLike);
		assert.ok(schema.$defs.Between);
		assert.ok(schema.$defs.Wildcard);
		assert.ok(schema.$defs.All);
		assert.equal(schema.$id.includes(`/v${SQON_SCHEMA_VERSION}.schema.json`), true);
		assert.deepEqual(schema.$defs.SQON, {
			oneOf: [{ $ref: '#/$defs/Group' }, { $ref: '#/$defs/Leaf' }],
		});
		assert.deepEqual(schema.$defs.Leaf.oneOf, [
			{ $ref: '#/$defs/InLike' },
			{ $ref: '#/$defs/All' },
			{ $ref: '#/$defs/RangeLike' },
			{ $ref: '#/$defs/Between' },
			{ $ref: '#/$defs/Wildcard' },
		]);
		// A group's children reference the SQON union by name rather than inlining it, since the
		// registry and the recursion share one schema instance.
		assert.deepEqual(schema.$defs.Group.properties.content.items, { $ref: '#/$defs/SQON' });
		// Canonical operators and aliases are two enums in a union, so they emit as two branches
		// rather than the flat enum Zod 3 collapsed them into.
		assert.deepEqual(schema.$defs.InLike.properties.op.oneOf, [
			{ type: 'string', enum: ['in', 'not-in', 'some-not-in'] },
			{ type: 'string', enum: ['=', '==', '===', '!=', '!=='] },
		]);
		assert.deepEqual(schema.$defs.RangeLike.properties.op.oneOf, [
			{ type: 'string', enum: ['gt', 'gte', 'lt', 'lte'] },
			{ type: 'string', enum: ['>', '>=', '<', '<='] },
		]);
	});

	test('emits no dangling $ref, and points only at $defs entry roots', () => {
		const schema = getSqonJsonSchema();
		const refs = new Set<string>();

		const collect = (value: unknown): void => {
			if (Array.isArray(value)) {
				return value.forEach(collect);
			}
			if (!value || typeof value !== 'object') {
				return;
			}
			for (const [key, child] of Object.entries(value)) {
				if (key === '$ref' && typeof child === 'string') {
					refs.add(child);
				} else {
					collect(child);
				}
			}
		};

		collect(schema);
		assert.ok(refs.size > 0);

		// Entry roots only, never a path through a union branch: that is what makes the rename safe.
		for (const ref of refs) {
			const name = ref.replace('#/$defs/', '');
			assert.equal(ref, `#/$defs/${name}`, `expected an entry-root pointer, got ${ref}`);
			assert.ok(schema.$defs[name], `dangling $ref: ${ref}`);
		}
	});

	test('returns a versioned JSON Schema payload', () => {
		const schema = getVersionedSqonJsonSchema();

		assert.equal(schema.version, SQON_SCHEMA_VERSION);
		assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
		assert.equal(schema.$id.includes(`/v${SQON_SCHEMA_VERSION}.schema.json`), true);
	});

	// Agents read these through /introspection/sqon, and docs/reference/04-sqon-in-detail.md says the
	// same thing for people, so the texts are pinned exactly.
	suite('field descriptions', () => {
		const PIVOT =
			'Path of a nested field that scopes this node: conditions under it on fields within that path are tested against one nested object at a time. A pivoted and or or matches a document when one of its nested objects satisfies the node; a pivoted not matches when none of its nested objects meets all of its conditions on that path. A pivot only scopes conditions: on a group with none, it has no effect, and the empty group matches every document. Without a pivot, conditions on a nested field may each be met by a different nested object. Must name a nested field of the catalogue being queried.';
		const FIELD_NAME =
			'Dotted path of the field this clause tests, such as donor.age. The key is fieldName: a clause that uses the key `field` instead names no field.';
		const VALUE = {
			All: 'The values the field must all hold, at least one.',
			Between: '[min, max], both inclusive.',
			InLike: 'A value, or a list of values, that the field is tested against. With in, an empty list matches nothing.',
			RangeLike:
				'The bound: a number, or a date string for a date field. Given a list, every bound applies, so the strictest one decides: the largest for gt and gte, the smallest for lt and lte.',
		};
		const FIELD_NAMES = 'The fields to search; a document matches if any one of them matches the pattern.';

		test('describes pivot on every node', () => {
			const { $defs } = getSqonJsonSchema();

			for (const node of ['All', 'Between', 'Group', 'InLike', 'RangeLike', 'Wildcard'] as const) {
				assert.equal($defs[node].properties.pivot.description, PIVOT, node);
			}
		});

		test('describes fieldName and value on every single-field clause', () => {
			const { $defs } = getSqonJsonSchema();

			for (const [clause, valueDescription] of Object.entries(VALUE)) {
				assert.equal($defs[clause].properties.content.properties.fieldName.description, FIELD_NAME, clause);
				assert.equal($defs[clause].properties.content.properties.value.description, valueDescription, clause);
			}
		});

		test('describes fieldNames on wildcard', () => {
			const { $defs } = getSqonJsonSchema();

			assert.equal($defs.Wildcard.properties.content.properties.fieldNames.description, FIELD_NAMES);
		});
	});
});
