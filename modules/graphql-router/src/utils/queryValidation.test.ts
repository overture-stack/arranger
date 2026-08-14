import assert from 'node:assert';
import { suite, test } from 'node:test';

import { buildSchema, getIntrospectionQuery, parse, validate } from 'graphql';

import { maxAliasesRule, maxDepthRule } from '#utils/queryValidation.js';

const schema = buildSchema(`
	type Query {
		field: String
		nested: Nested
	}
	type Nested {
		a: String
		b: Nested
	}
`);

const run = (rules: Parameters<typeof validate>[2], query: string) =>
	validate(schema, parse(query), rules);

suite('maxAliasesRule', () => {
	test('passes when there are no aliases', () => {
		const errors = run([maxAliasesRule(2)], `{ field nested { a } }`);
		assert.equal(errors.length, 0);
	});

	test('passes when alias count is at the limit', () => {
		const errors = run([maxAliasesRule(2)], `{ a1: field a2: field }`);
		assert.equal(errors.length, 0);
	});

	test('fails when alias count exceeds the limit', () => {
		const errors = run([maxAliasesRule(2)], `{ a1: field a2: field a3: field }`);
		assert.equal(errors.length, 1);
		assert.match(errors[0].message, /alias limit exceeded/);
		assert.match(errors[0].message, /3.*aliases/);
	});

	test('uses default limit of 15 when none is provided', () => {
		const aliases = Array.from({ length: 16 }, (_, i) => `a${i}: field`).join(' ');
		const errors = run([maxAliasesRule()], `{ ${aliases} }`);
		assert.equal(errors.length, 1);
	});

	test('counts only aliased fields, not plain fields', () => {
		const errors = run([maxAliasesRule(1)], `{ field nested { a } }`);
		assert.equal(errors.length, 0);
	});
});

suite('maxDepthRule', () => {
	test('passes for a shallow query', () => {
		const errors = run([maxDepthRule(3)], `{ field }`);
		assert.equal(errors.length, 0);
	});

	test('passes when depth is at the limit', () => {
		const errors = run([maxDepthRule(3)], `{ nested { b { a } } }`);
		assert.equal(errors.length, 0);
	});

	test('fails when depth exceeds the limit', () => {
		const errors = run([maxDepthRule(3)], `{ nested { b { b { a } } } }`);
		assert.equal(errors.length > 0, true);
		assert.match(errors[0].message, /depth limit exceeded/);
	});

	test('uses default limit of 7 when none is provided', () => {
		const deepQuery = `{ nested { b { b { b { b { b { b { a } } } } } } } }`;
		const errors = run([maxDepthRule()], deepQuery);
		assert.equal(errors.length > 0, true);
	});

	test('passes a query exactly at default depth', () => {
		const query = `{ nested { b { b { b { b { b { a } } } } } } }`;
		const errors = run([maxDepthRule()], query);
		assert.equal(errors.length, 0);
	});

	test('does not count introspection meta-fields toward depth', () => {
		const query = `{
			__schema {
				types {
					fields {
						type {
							ofType {
								ofType {
									ofType {
										ofType {
											name
										}
									}
								}
							}
						}
					}
				}
			}
		}`;
		const errors = run([maxDepthRule()], query);
		assert.equal(errors.length, 0);
	});

	test('passes the real client-generated IntrospectionQuery (its TypeRef fragment nests ofType 9 levels deep)', () => {
		// TypeRef is a standalone top-level fragment definition typed `on __Type`, not something
		// nested under a `__schema`/`__type` field, so a check on field names alone misses it.
		const errors = run([maxDepthRule()], getIntrospectionQuery());
		assert.equal(errors.length, 0);
	});

	test('still enforces the limit for a normal field alongside an introspection field', () => {
		const query = `{
			__schema { types { name } }
			nested { b { b { b { b { b { b { a } } } } } } }
		}`;
		const errors = run([maxDepthRule()], query);
		assert.equal(errors.length > 0, true);
		assert.match(errors[0].message, /depth limit exceeded/);
	});
});
