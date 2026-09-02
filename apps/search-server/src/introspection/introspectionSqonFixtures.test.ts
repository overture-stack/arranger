import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import express from 'express';
import request from 'supertest';

import {
	METADATA_FIXTURE_FILENAME,
	readFixture,
	regenerationHint,
	SCHEMA_FIXTURE_FILENAME,
	sortKeysDeep,
} from '#introspection/introspectionSqonFixtures.js';
import buildSqonDetails from '#introspection/sqonDetails.js';

import createIntrospectionRoutes from './index.js';

/**
 * `GET /introspection/sqon` is a published contract: REST clients read it, and the MCP Server returns
 * it verbatim from `get_sqon_schema`. Nothing else in this repo validates the JSON Schema it carries,
 * so these fixtures are the only thing that notices when it moves.
 *
 * A failure here is not a broken test, it is the contract telling you it changed. See
 * ../../scripts/README.md.
 */
suite('GET /introspection/sqon: published contract', () => {
	const { schema, ...metadata } = buildSqonDetails();

	test('the JSON Schema matches its committed fixture', () => {
		assert.deepEqual(sortKeysDeep(schema), readFixture(SCHEMA_FIXTURE_FILENAME), regenerationHint);
	});

	test('the operator metadata matches its committed fixture', () => {
		assert.deepEqual(sortKeysDeep(metadata), readFixture(METADATA_FIXTURE_FILENAME), regenerationHint);
	});

	// The fixtures are built from buildSqonDetails() directly; this proves they describe the
	// endpoint, not just the function behind it.
	test('the served response is exactly the two fixtures combined', async () => {
		const router = createIntrospectionRoutes({
			catalogs: { donor: { documentType: 'donor' } },
			catalogueRouters: {},
			catalogueStatuses: { donor: { status: 'available' } },
		});

		const response = await request(express().use(router)).get('/introspection/sqon');

		assert.equal(response.status, 200);
		assert.deepEqual(sortKeysDeep(response.body), {
			...(readFixture(METADATA_FIXTURE_FILENAME) as Record<string, unknown>),
			schema: readFixture(SCHEMA_FIXTURE_FILENAME),
		});
	});

	/**
	 * Guards the latent `$ref` defect in `.dev/tech-debt.md`: `normalizeUnionKeywords` rewrites
	 * `anyOf` to `oneOf` without touching `$ref` path strings, so any pointer routed through an
	 * `anyOf` segment stops resolving. None currently is, but only because of `$defs` declaration
	 * order. The Zod 4 rewrite must preserve this.
	 */
	test('every $ref in the published schema resolves', () => {
		const document = readFixture(SCHEMA_FIXTURE_FILENAME);
		const refs = new Set<string>();

		const collectRefs = (value: unknown): void => {
			if (Array.isArray(value)) {
				return value.forEach(collectRefs);
			}

			if (!value || typeof value !== 'object') {
				return;
			}

			for (const [key, childValue] of Object.entries(value)) {
				if (key === '$ref' && typeof childValue === 'string') {
					refs.add(childValue);
				} else {
					collectRefs(childValue);
				}
			}
		};

		collectRefs(document);
		assert.ok(refs.size > 0, 'expected the published schema to contain at least one $ref');

		for (const ref of refs) {
			assert.ok(ref.startsWith('#/'), `only local JSON Pointers are expected, found ${ref}`);

			// Walked segment by segment so a failure names the offending ref.
			const resolved = ref
				.slice(2)
				.split('/')
				.reduce<unknown>((node, segment) => {
					if (!node || typeof node !== 'object' || !(segment in node)) {
						return undefined;
					}

					return (node as Record<string, unknown>)[segment];
				}, document);

			assert.notEqual(resolved, undefined, `dangling $ref: "${ref}" does not resolve`);
		}
	});
});
