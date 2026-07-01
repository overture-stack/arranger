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
		assert.deepEqual(schema.$defs.Group.properties.content.items.oneOf, [
			{ $ref: '#/$defs/Group' },
			{ $ref: '#/$defs/Leaf' },
		]);
		assert.deepEqual(schema.$defs.InLike.properties.op.enum, [
			'in',
			'not-in',
			'some-not-in',
			'=',
			'==',
			'===',
			'!=',
			'!==',
		]);
		assert.deepEqual(schema.$defs.RangeLike.properties.op.enum, ['gt', 'gte', 'lt', 'lte', '>', '>=', '<', '<=']);
	});

	test('returns a versioned JSON Schema payload', () => {
		const schema = getVersionedSqonJsonSchema();

		assert.equal(schema.version, SQON_SCHEMA_VERSION);
		assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
		assert.equal(schema.$id.includes(`/v${SQON_SCHEMA_VERSION}.schema.json`), true);
	});
});
