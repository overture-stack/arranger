import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SQON_SCHEMA_VERSION } from '@overture-stack/sqon';

/**
 * Shared by the `GET /introspection/sqon` fixtures, their test, and the generator that writes them
 * (`scripts/generateIntrospectionSqonFixtures.mts`), so the two sides cannot drift.
 */

export const SCHEMA_FIXTURE_FILENAME = 'introspectionSqon.schema.json';

/**
 * The response minus the JSON Schema: `$schema`, `title`, `description`, `version`, `aliases`,
 * `operators`.
 *
 * Not "envelope": `.gitignore`'s `**\/*.env*` dotenv rule also matches `*.envelope.json`, silently
 * excluding the file from both commits and Prettier.
 */
export const METADATA_FIXTURE_FILENAME = 'introspectionSqon.metadata.json';

/** Stands in for SQON_SCHEMA_VERSION, so a release bump does not rewrite the fixtures. */
export const SQON_SCHEMA_VERSION_PLACEHOLDER = '__SQON_SCHEMA_VERSION__';

/** Sorts object keys recursively, so Zod 4's different key order cannot swamp the migration diff. */
export const sortKeysDeep = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(sortKeysDeep);
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	return Object.fromEntries(
		Object.keys(value as Record<string, unknown>)
			.sort()
			.map((key) => [key, sortKeysDeep((value as Record<string, unknown>)[key])]),
	);
};

/**
 * Reads a fixture, substituting the live schema version back in.
 *
 * `readFileSync` rather than a JSON import: imported JSON is one cached object shared by every
 * importer, and the substitution below mutates.
 */
export const readFixture = (filename: string): unknown => {
	const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), filename);
	const contents = readFileSync(fixturePath, 'utf8');

	return JSON.parse(contents.replaceAll(SQON_SCHEMA_VERSION_PLACEHOLDER, SQON_SCHEMA_VERSION));
};

/** Appended to every mismatch: the contract moved, so the fix is never "make the test pass". */
export const regenerationHint = [
	'The published GET /introspection/sqon contract has changed.',
	'Regenerate with: npm run fixtures:introspection-sqon -w apps/search-server',
	'Then review the git diff and decide whether SQON_SCHEMA_VERSION needs a bump before committing.',
].join('\n');
