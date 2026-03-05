import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { suite, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { getSqonJsonSchema, getVersionedSqonJsonSchema } from '#jsonSchema.js';
import { SQON_SCHEMA_VERSION } from '#version.js';

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
		assert.equal(schema.type, 'object');
		assert.equal(schema.$id.includes(`/v${SQON_SCHEMA_VERSION}.schema.json`), true);
	});

	test('returns a versioned JSON Schema payload', () => {
		const schema = getVersionedSqonJsonSchema();

		assert.equal(schema.version, SQON_SCHEMA_VERSION);
		assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
		assert.equal(schema.$id.includes(`/v${SQON_SCHEMA_VERSION}.schema.json`), true);
	});
});
