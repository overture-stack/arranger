#!/usr/bin/env tsx
/**
 * Regenerates the committed `GET /introspection/sqon` fixtures.
 *
 * Usage: npm run fixtures:introspection-sqon -w apps/search-server
 *
 * See ./README.md for when to run this, and for why the fixtures exist at all. Read the resulting
 * `git diff`: it is a change to a published contract, so decide whether SQON_SCHEMA_VERSION needs a
 * bump before committing.
 *
 * `buildSqonDetails()` is a zero-argument pure function, so no server, Elasticsearch, or network is
 * involved. Three details the test depends on: the response is split in two so schema and operator
 * changes stay out of each other's diffs, the version is stored as a placeholder so releases do not
 * churn the files, and keys are sorted then Prettier-formatted so the diff stays readable and
 * `scripts/format-all.sh` cannot silently reformat them.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SQON_SCHEMA_VERSION } from '@overture-stack/sqon';

import {
	METADATA_FIXTURE_FILENAME,
	SCHEMA_FIXTURE_FILENAME,
	SQON_SCHEMA_VERSION_PLACEHOLDER,
	sortKeysDeep,
} from '../src/introspection/introspectionSqonFixtures.js';
import buildSqonDetails from '../src/introspection/sqonDetails.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const introspectionDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/introspection');

const { schema, ...metadata } = buildSqonDetails();

/**
 * Swaps the live version for the placeholder. Asserts the count, so a new field carrying the version
 * cannot be written as a literal and start churning on release unnoticed.
 */
const withPlaceholder = (value: unknown, expectedOccurrences: number, label: string): string => {
	const serialized = JSON.stringify(sortKeysDeep(value), null, '\t');
	const occurrences = serialized.split(SQON_SCHEMA_VERSION).length - 1;

	if (occurrences !== expectedOccurrences) {
		throw new Error(
			`${label}: expected ${expectedOccurrences} occurrence(s) of the schema version, found ${occurrences}. ` +
				`Update the expected count here and in introspectionSqonFixtures.ts if this is intentional.`,
		);
	}

	return `${serialized.replaceAll(SQON_SCHEMA_VERSION, SQON_SCHEMA_VERSION_PLACEHOLDER)}\n`;
};

// `schema` carries the version twice, in `version` and in the `$id` URL; the metadata once.
const written = [
	[SCHEMA_FIXTURE_FILENAME, withPlaceholder(schema, 2, SCHEMA_FIXTURE_FILENAME)],
	[METADATA_FIXTURE_FILENAME, withPlaceholder(metadata, 1, METADATA_FIXTURE_FILENAME)],
] as const;

for (const [filename, contents] of written) {
	writeFileSync(resolve(introspectionDir, filename), contents);
}

execFileSync(
	'npx',
	[
		'prettier',
		'--config',
		resolve(repoRoot, 'prettier.config.js'),
		'--write',
		...written.map(([filename]) => resolve(introspectionDir, filename)),
	],
	{ cwd: repoRoot, stdio: 'inherit' },
);

console.log(`wrote ${written.map(([filename]) => filename).join(', ')} (version ${SQON_SCHEMA_VERSION})`);
