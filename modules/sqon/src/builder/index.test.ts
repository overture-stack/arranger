import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { SqonBuilder } from '#builder/index.js';
import type { SqonBuilderHandle } from '#builder/index.js';
import { reduceSqon } from '#builder/reduce.js';
import { SqonSchema } from '#schema/index.js';

suite('SQON builder', () => {
	suite('SqonBuilder.empty()', () => {
		test('produces an empty and-combination', () => {
			const result = SqonBuilder.empty().toValue();
			assert.deepEqual(result, { op: 'and', content: [] });
		});
	});

	suite('SqonBuilder.matchNothing()', () => {
		test('produces an in filter with an empty value list', () => {
			const result = SqonBuilder.matchNothing('study').toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'study', value: [] } });
		});

		test('validates against SqonSchema', () => {
			const result = SqonBuilder.matchNothing('study').toValue();
			assert.equal(SqonSchema.safeParse(result).success, true);
		});

		test('survives a round-trip through SqonBuilder.from().toValue() unchanged', () => {
			const original = SqonBuilder.matchNothing('study').toValue();
			const roundTripped = SqonBuilder.from(original).toValue();
			assert.deepEqual(roundTripped, original);
		});

		test('survives composition with another filter via .and()', () => {
			const other = { op: 'in', content: { fieldName: 'gender', value: ['male'] } };
			const result = SqonBuilder.matchNothing('study').and(other).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [{ op: 'in', content: { fieldName: 'study', value: [] } }, other],
			});
		});

		test('is not erased by an and-composed filter on the same field', () => {
			const other = { op: 'in', content: { fieldName: 'study', value: ['x'] } };
			const result = SqonBuilder.matchNothing('study').and(other).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [{ op: 'in', content: { fieldName: 'study', value: [] } }, other],
			});
		});

		test('is not erased regardless of which side of the composition it is on', () => {
			const other = { op: 'in', content: { fieldName: 'study', value: ['x'] } };
			const result = SqonBuilder.in('study', ['x']).and(SqonBuilder.matchNothing('study').toValue()).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [other, { op: 'in', content: { fieldName: 'study', value: [] } }],
			});
		});
	});

	suite('SqonBuilder.from()', () => {
		test('parses a valid SQON object', () => {
			const input = { op: 'in', content: { fieldName: 'status', value: ['active'] } };
			const result = SqonBuilder.from(input).toValue();
			assert.deepEqual(result, input);
		});

		test('parses a valid SQON JSON string', () => {
			const input = { op: 'in', content: { fieldName: 'status', value: ['active'] } };
			const result = SqonBuilder.from(JSON.stringify(input)).toValue();
			assert.deepEqual(result, input);
		});

		test('throws on an invalid SQON object', () => {
			assert.throws(() => SqonBuilder.from({ op: 'unknown', content: {} }));
		});

		test('throws on a null input', () => {
			assert.throws(() => SqonBuilder.from(null));
		});

		test('normalizes an operator alias to its canonical form', () => {
			const result = SqonBuilder.from({ op: '=', content: { fieldName: 'status', value: ['active'] } }).toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active'] } });
		});

		test('normalizes an aliased leaf nested inside a combination', () => {
			const result = SqonBuilder.from({
				op: 'and',
				content: [
					{ op: '>=', content: { fieldName: 'age', value: 18 } },
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
				],
			}).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'gte', content: { fieldName: 'age', value: 18 } },
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
				],
			});
		});
	});

	suite('toString()', () => {
		test('returns a JSON string of the SQON value', () => {
			const result = SqonBuilder.in('status', ['active']).toString();
			assert.equal(result, JSON.stringify({ op: 'in', content: { fieldName: 'status', value: ['active'] } }));
		});
	});

	suite('toValue()', () => {
		test('returns the underlying SqonNode', () => {
			const result = SqonBuilder.in('status', ['active']).toValue();
			assert.equal(typeof result, 'object');
			assert.equal(result.op, 'in');
		});

		test('returned node has no builder methods attached', () => {
			const result = SqonBuilder.in('status', ['active']).toValue();
			assert.equal('toValue' in result, false);
			assert.equal('and' in result, false);
		});
	});

	suite('leaf filter methods', () => {
		suite('in()', () => {
			test('builds an in filter with a single value normalized to array', () => {
				const result = SqonBuilder.in('status', 'active').toValue();
				assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active'] } });
			});

			test('builds an in filter with an array value', () => {
				const result = SqonBuilder.in('status', ['active', 'pending']).toValue();
				assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active', 'pending'] } });
			});

			test('accepts boolean values', () => {
				const result = SqonBuilder.in('flagged', true).toValue();
				assert.deepEqual(result, { op: 'in', content: { fieldName: 'flagged', value: [true] } });
			});

			test('accepts numeric values', () => {
				const result = SqonBuilder.in('count', [1, 2, 3]).toValue();
				assert.deepEqual(result, { op: 'in', content: { fieldName: 'count', value: [1, 2, 3] } });
			});
		});

		suite('notIn()', () => {
			test('builds a not-in filter with a single value normalized to array', () => {
				const result = SqonBuilder.notIn('status', 'deleted').toValue();
				assert.deepEqual(result, { op: 'not-in', content: { fieldName: 'status', value: ['deleted'] } });
			});

			test('builds a not-in filter with an array value', () => {
				const result = SqonBuilder.notIn('status', ['deleted', 'archived']).toValue();
				assert.deepEqual(result, {
					op: 'not-in',
					content: { fieldName: 'status', value: ['deleted', 'archived'] },
				});
			});
		});

		suite('someNotIn()', () => {
			test('builds a some-not-in filter', () => {
				const result = SqonBuilder.someNotIn('tags', ['a', 'b']).toValue();
				assert.deepEqual(result, { op: 'some-not-in', content: { fieldName: 'tags', value: ['a', 'b'] } });
			});
		});

		suite('all()', () => {
			test('builds an all filter', () => {
				const result = SqonBuilder.all('tags', ['required', 'critical']).toValue();
				assert.deepEqual(result, {
					op: 'all',
					content: { fieldName: 'tags', value: ['required', 'critical'] },
				});
			});
		});

		suite('gt()', () => {
			test('builds a gt filter', () => {
				const result = SqonBuilder.gt('age', 18).toValue();
				assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 18 } });
			});
		});

		suite('gte()', () => {
			test('builds a gte filter', () => {
				const result = SqonBuilder.gte('age', 18).toValue();
				assert.deepEqual(result, { op: 'gte', content: { fieldName: 'age', value: 18 } });
			});
		});

		suite('lt()', () => {
			test('builds an lt filter', () => {
				const result = SqonBuilder.lt('age', 65).toValue();
				assert.deepEqual(result, { op: 'lt', content: { fieldName: 'age', value: 65 } });
			});
		});

		suite('lte()', () => {
			test('builds an lte filter', () => {
				const result = SqonBuilder.lte('age', 65).toValue();
				assert.deepEqual(result, { op: 'lte', content: { fieldName: 'age', value: 65 } });
			});
		});

		suite('between()', () => {
			test('builds a between filter with an exact two-element tuple', () => {
				const result = SqonBuilder.between('age', [18, 65]).toValue();
				assert.deepEqual(result, { op: 'between', content: { fieldName: 'age', value: [18, 65] } });
			});
		});

		suite('wildcard()', () => {
			test('builds a wildcard op node from a single field name', () => {
				const result = SqonBuilder.wildcard('donor.name', 'jo*').toValue();
				assert.deepEqual(result, {
					op: 'wildcard',
					content: { fieldNames: ['donor.name'], value: 'jo*' },
				});
			});

			test('builds a wildcard op node from an array of field names', () => {
				const result = SqonBuilder.wildcard(['donor.name', 'donor.alias'], 'jo*').toValue();
				assert.deepEqual(result, {
					op: 'wildcard',
					content: { fieldNames: ['donor.name', 'donor.alias'], value: 'jo*' },
				});
			});

			test('op is "wildcard"', () => {
				const result = SqonBuilder.wildcard('name', 'jo*').toValue();
				assert.equal(result.op, 'wildcard');
			});
		});
	});

	suite('combination methods', () => {
		suite('and()', () => {
			test('wraps two filters in an and-combination', () => {
				const result = SqonBuilder.and([
					SqonBuilder.in('status', ['active']).toValue(),
					SqonBuilder.gt('age', 18).toValue(),
				]).toValue();
				assert.deepEqual(result, {
					op: 'and',
					content: [
						{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
						{ op: 'gt', content: { fieldName: 'age', value: 18 } },
					],
				});
			});

			test('chains a new filter onto an existing builder', () => {
				const result = SqonBuilder.in('status', ['active']).and(SqonBuilder.gt('age', 18).toValue()).toValue();
				assert.deepEqual(result, {
					op: 'and',
					content: [
						{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
						{ op: 'gt', content: { fieldName: 'age', value: 18 } },
					],
				});
			});

			test('flattens nested and-combinations at the same pivot', () => {
				const result = SqonBuilder.in('a', [1]).and(SqonBuilder.in('b', [2]).toValue()).and(SqonBuilder.in('c', [3]).toValue()).toValue();
				assert.equal(result.op, 'and');
				assert.equal((result as { content: unknown[] }).content.length, 3);
			});
		});

		suite('or()', () => {
			test('wraps filters in an or-combination', () => {
				const result = SqonBuilder.or([
					SqonBuilder.in('status', ['active']).toValue(),
					SqonBuilder.gt('age', 18).toValue(),
				]).toValue();
				assert.deepEqual(result, {
					op: 'or',
					content: [
						{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
						{ op: 'gt', content: { fieldName: 'age', value: 18 } },
					],
				});
			});

			test('merges in filters on the same field under or (same as under and)', () => {
				const result = SqonBuilder.or([
					SqonBuilder.in('status', ['active']).toValue(),
					SqonBuilder.in('status', ['pending']).toValue(),
				]).toValue();
				assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active', 'pending'] } });
			});
		});

		suite('not()', () => {
			test('wraps a filter in a not-combination', () => {
				const result = SqonBuilder.not(SqonBuilder.in('status', ['deleted']).toValue()).toValue();
				assert.deepEqual(result, {
					op: 'not',
					content: [{ op: 'in', content: { fieldName: 'status', value: ['deleted'] } }],
				});
			});

			test('wraps an array of filters in a not-combination', () => {
				const result = SqonBuilder.not([
					SqonBuilder.in('status', ['deleted']).toValue(),
					SqonBuilder.in('status', ['archived']).toValue(),
				]).toValue();
				assert.equal(result.op, 'not');
			});

			test('chains not onto an existing builder under an implicit and', () => {
				const result = SqonBuilder.in('status', ['active']).not(SqonBuilder.in('type', ['internal']).toValue()).toValue();
				assert.deepEqual(result, {
					op: 'and',
					content: [
						{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
						{ op: 'not', content: [{ op: 'in', content: { fieldName: 'type', value: ['internal'] } }] },
					],
				});
			});
		});

		test('leaf builder methods add via implicit and', () => {
			const result = SqonBuilder.in('status', ['active']).gt('age', 18).lte('score', 100).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'gt', content: { fieldName: 'age', value: 18 } },
					{ op: 'lte', content: { fieldName: 'score', value: 100 } },
				],
			});
		});
	});

	suite('pivot', () => {
		test('and() preserves a pivot on the combination', () => {
			const result = SqonBuilder.and(
				[SqonBuilder.in('nested.field', ['x']).toValue()],
				'nested',
			).toValue();
			assert.deepEqual(result, {
				op: 'and',
				pivot: 'nested',
				content: [{ op: 'in', content: { fieldName: 'nested.field', value: ['x'] } }],
			});
		});

		test('does not add pivot key when not specified', () => {
			const result = SqonBuilder.in('a', [1]).toValue();
			assert.equal('pivot' in result, false);
		});
	});

	suite('reduceSqon (deduplication)', () => {
		test('does not merge same-field filters carrying different pivots', () => {
			const scoped = { op: 'not-in', content: { fieldName: 'donors.age', value: [10] }, pivot: 'donors' };
			const unscoped = { op: 'not-in', content: { fieldName: 'donors.age', value: [20] } };
			const result = SqonBuilder.from({ op: 'and', content: [scoped, unscoped] }).toValue();
			assert.deepEqual(result, { op: 'and', content: [scoped, unscoped] });
		});

		test('still merges same-field filters that share the same pivot', () => {
			const a = { op: 'not-in', content: { fieldName: 'donors.age', value: [10] }, pivot: 'donors' };
			const b = { op: 'not-in', content: { fieldName: 'donors.age', value: [20] }, pivot: 'donors' };
			const result = SqonBuilder.from({ op: 'and', content: [a, b] }).toValue();
			assert.deepEqual(result, { op: 'not-in', content: { fieldName: 'donors.age', value: [10, 20] }, pivot: 'donors' });
		});

		test('does not merge duplicate in filters on the same field under and (needs intersection, not union)', () => {
			const result = SqonBuilder.in('status', ['active']).in('status', ['pending']).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'in', content: { fieldName: 'status', value: ['pending'] } },
				],
			});
		});

		test('an empty in filter is left as its own clause under and, not merged away', () => {
			const result = SqonBuilder.in('status', []).and(SqonBuilder.in('status', ['active']).toValue()).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: [] } },
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
				],
			});
		});

		test('an empty not-in filter still unions normally under and (the absorb rule is in-only)', () => {
			const result = SqonBuilder.notIn('s', []).and(SqonBuilder.notIn('s', ['x']).toValue()).toValue();
			assert.deepEqual(result, { op: 'not-in', content: { fieldName: 's', value: ['x'] } });
		});

		test('an empty in filter still unions normally under or', () => {
			const result = SqonBuilder.or([
				SqonBuilder.in('status', []).toValue(),
				SqonBuilder.in('status', ['active']).toValue(),
			]).toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active'] } });
		});

		test('merges duplicate in filters on the same field under or (OR just widens the set)', () => {
			const result = SqonBuilder.or([
				SqonBuilder.in('status', ['active']).toValue(),
				SqonBuilder.in('status', ['pending']).toValue(),
			]).toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active', 'pending'] } });
		});

		test('merges not-in filters on the same field under and', () => {
			const result = SqonBuilder.notIn('status', ['deleted']).notIn('status', ['archived']).toValue();
			assert.deepEqual(result, { op: 'not-in', content: { fieldName: 'status', value: ['deleted', 'archived'] } });
		});

		test('keeps not-in filters on the same field separate under or', () => {
			const result = SqonBuilder.or([
				SqonBuilder.notIn('status', ['deleted']).toValue(),
				SqonBuilder.notIn('status', ['archived']).toValue(),
			]).toValue();
			assert.deepEqual(result, {
				op: 'or',
				content: [
					{ op: 'not-in', content: { fieldName: 'status', value: ['deleted'] } },
					{ op: 'not-in', content: { fieldName: 'status', value: ['archived'] } },
				],
			});
		});

		test('merges all filters on the same field under and', () => {
			const result = SqonBuilder.all('tags', ['urgent']).all('tags', ['reviewed']).toValue();
			assert.deepEqual(result, { op: 'all', content: { fieldName: 'tags', value: ['urgent', 'reviewed'] } });
		});

		test('keeps all filters on the same field separate under or', () => {
			const result = SqonBuilder.or([
				SqonBuilder.all('tags', ['urgent']).toValue(),
				SqonBuilder.all('tags', ['reviewed']).toValue(),
			]).toValue();
			assert.deepEqual(result, {
				op: 'or',
				content: [
					{ op: 'all', content: { fieldName: 'tags', value: ['urgent'] } },
					{ op: 'all', content: { fieldName: 'tags', value: ['reviewed'] } },
				],
			});
		});

		test('keeps the greater gt value under and', () => {
			const a = SqonBuilder.gt('age', 10);
			const b = SqonBuilder.gt('age', 20);
			const result = a.and(b.toValue()).toValue();
			assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 20 } });
		});

		test('keeps the lesser gt value under or', () => {
			const result = SqonBuilder.or([SqonBuilder.gt('age', 20).toValue(), SqonBuilder.gt('age', 10).toValue()]).toValue();
			assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 10 } });
		});

		test('keeps the greater gte value under and', () => {
			const result = SqonBuilder.gte('age', 10).and(SqonBuilder.gte('age', 20).toValue()).toValue();
			assert.deepEqual(result, { op: 'gte', content: { fieldName: 'age', value: 20 } });
		});

		test('keeps the lesser lt value under and', () => {
			const result = SqonBuilder.lt('age', 100).and(SqonBuilder.lt('age', 65).toValue()).toValue();
			assert.deepEqual(result, { op: 'lt', content: { fieldName: 'age', value: 65 } });
		});

		test('keeps the greater lt value under or', () => {
			const result = SqonBuilder.or([SqonBuilder.lt('age', 65).toValue(), SqonBuilder.lt('age', 100).toValue()]).toValue();
			assert.deepEqual(result, { op: 'lt', content: { fieldName: 'age', value: 100 } });
		});

		test('keeps the lesser lte value under and', () => {
			const result = SqonBuilder.lte('age', 100).and(SqonBuilder.lte('age', 65).toValue()).toValue();
			assert.deepEqual(result, { op: 'lte', content: { fieldName: 'age', value: 65 } });
		});

		test('unwraps a single-item and-combination to the item itself', () => {
			const inner = SqonBuilder.in('status', ['active']).toValue();
			const result = SqonBuilder.and([inner]).toValue();
			assert.deepEqual(result, inner);
		});

		test('keeps both between filters on the same field (non-reducible)', () => {
			const result = SqonBuilder.between('age', [18, 40]).and(SqonBuilder.between('age', [30, 65]).toValue()).toValue();
			const content = (result as { content: unknown[] }).content;
			assert.equal(result.op, 'and');
			assert.equal(content.length, 2);
		});

		test('removes empty inner combinations', () => {
			const result = SqonBuilder.and([SqonBuilder.empty().toValue(), SqonBuilder.in('status', ['active']).toValue()]).toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active'] } });
		});

		test('a match-none leaf survives alongside an empty combination that gets pruned', () => {
			// Only the empty *combination* is pruned; a leaf, match-none or otherwise, never is.
			const denyLeaf = { op: 'in', content: { fieldName: 'study', value: [] } };
			const result = SqonBuilder.and([SqonBuilder.empty().toValue(), denyLeaf]).toValue();
			assert.deepEqual(result, denyLeaf);
		});

		test('merges a same-field filter nested inside a single-item wrapper, in one pass', () => {
			const a = { op: 'and', content: [{ op: 'not-in', content: { fieldName: 'a', value: ['1'] } }] };
			const b = { op: 'and', content: [{ op: 'not-in', content: { fieldName: 'a', value: ['2'] } }] };
			const result = SqonBuilder.from({ op: 'and', content: [a, b] }).toValue();
			assert.deepEqual(result, { op: 'not-in', content: { fieldName: 'a', value: ['1', '2'] } });
		});

		test('SqonBuilder.from(a).and(b) merges a same-field filter regardless of nesting', () => {
			const a = { op: 'and', content: [{ op: 'not-in', content: { fieldName: 'a', value: ['1'] } }] };
			const b = { op: 'and', content: [{ op: 'not-in', content: { fieldName: 'a', value: ['2'] } }] };
			const result = SqonBuilder.from(a).and(b).toValue();
			assert.deepEqual(result, { op: 'not-in', content: { fieldName: 'a', value: ['1', '2'] } });
		});

		test('reduceSqon is idempotent: a second pass changes nothing a first pass already reduced', () => {
			const nested = {
				op: 'and',
				content: [
					{ op: 'and', content: [{ op: 'not-in', content: { fieldName: 'a', value: ['1'] } }] },
					{ op: 'and', content: [{ op: 'not-in', content: { fieldName: 'a', value: ['2'] } }] },
				],
			};
			const once = SqonBuilder.from(nested).toValue();
			const twice = reduceSqon(once);
			assert.deepEqual(twice, once);
		});

		test('merges a same-field filter across a sibling that only becomes a leaf via its own internal merge', () => {
			// A child collapsing to a leaf via its own merge must still be offered to the parent's
			// same-field merge check, not folded in unmerged.
			const nested = {
				op: 'and',
				content: [
					{
						op: 'and',
						content: [
							{ op: 'not-in', content: { fieldName: 's', value: ['x'] } },
							{ op: 'not-in', content: { fieldName: 's', value: ['y'] } },
						],
					},
					{ op: 'not-in', content: { fieldName: 's', value: ['z'] } },
				],
			};
			const once = SqonBuilder.from(nested).toValue();
			assert.deepEqual(once, { op: 'not-in', content: { fieldName: 's', value: ['x', 'y', 'z'] } });
			assert.deepEqual(reduceSqon(once), once);
		});

		test('preserves the pivot on a single-item pivoted group nested inside another combination', () => {
			const pivoted = { op: 'and', content: [{ op: 'in', content: { fieldName: 'a', value: ['1'] } }], pivot: 'donors' };
			const result = SqonBuilder.from({ op: 'and', content: [pivoted, { op: 'in', content: { fieldName: 'b', value: ['2'] } }] }).toValue();
			assert.deepEqual(result, { op: 'and', content: [pivoted, { op: 'in', content: { fieldName: 'b', value: ['2'] } }] });
		});

		test('deduplicates a merged value array that stays part of a combination', () => {
			// A merge result promoted to a bare leaf gets deduplicated by reduceSqon's leaf branch; one
			// that stays inside a combination (kept alive here by a third clause on a different field)
			// bypasses that branch, so mergeIntoExisting's result must already be deduplicated.
			const nested = {
				op: 'and',
				content: [
					{ op: 'not-in', content: { fieldName: 'a', value: ['1', '2'] } },
					{ op: 'not-in', content: { fieldName: 'a', value: ['2'] } },
					{ op: 'in', content: { fieldName: 'b', value: ['x'] } },
				],
			};
			const once = SqonBuilder.from(nested).toValue();
			assert.deepEqual(once, {
				op: 'and',
				content: [
					{ op: 'not-in', content: { fieldName: 'a', value: ['1', '2'] } },
					{ op: 'in', content: { fieldName: 'b', value: ['x'] } },
				],
			});
			assert.deepEqual(reduceSqon(once), once);
		});

		test('does not merge same-field filters under not, of any op', () => {
			// A `not`'s children are each negated independently (De Morgan): merging them like an
			// `and`'s children solves a different query. Two `not-in` clauses would need to become an
			// `in` of their *intersection*, not a `not-in` of their union, a flip none of the merge
			// rules perform, so refusing to merge here is the only correct behaviour.
			const notIn = { op: 'not', content: [
				{ op: 'not-in', content: { fieldName: 'a', value: ['2', '3'] } },
				{ op: 'not-in', content: { fieldName: 'a', value: ['1'] } },
			]};
			assert.deepEqual(SqonBuilder.from(notIn).toValue(), notIn);

			const inOp = { op: 'not', content: [
				{ op: 'in', content: { fieldName: 'a', value: ['1'] } },
				{ op: 'in', content: { fieldName: 'a', value: ['2'] } },
			]};
			assert.deepEqual(SqonBuilder.from(inOp).toValue(), inOp);

			const gt = { op: 'not', content: [
				{ op: 'gt', content: { fieldName: 'age', value: 10 } },
				{ op: 'gt', content: { fieldName: 'age', value: 20 } },
			]};
			assert.deepEqual(SqonBuilder.from(gt).toValue(), gt);
		});

		test('deduplicates values within an in filter', () => {
			const result = SqonBuilder.in('status', ['active', 'active', 'pending']).toValue();
			// Duplicates within a single filter's value array are removed
			const content = (result as { content: { value: unknown[] } }).content;
			assert.equal(content.value.filter((v) => v === 'active').length, 1);
		});
	});

	suite('setFilter()', () => {
		test('replaces an existing filter with the same field and op', () => {
			const result = SqonBuilder.in('status', ['active']).setFilter('status', 'in', ['pending']).toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['pending'] } });
		});

		test('adds a new filter when no match exists', () => {
			const result = SqonBuilder.in('status', ['active']).setFilter('type', 'in', ['sample']).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'in', content: { fieldName: 'type', value: ['sample'] } },
				],
			});
		});

		test('replaces a matching filter inside a group', () => {
			const initial = SqonBuilder.in('status', ['active']).gt('age', 18);
			const result = initial.setFilter('age', 'gt', 25).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'gt', content: { fieldName: 'age', value: 25 } },
				],
			});
		});

		test('sets a between filter', () => {
			const result = SqonBuilder.setFilter('age', 'between', [18, 65]).toValue();
			assert.deepEqual(result, { op: 'between', content: { fieldName: 'age', value: [18, 65] } });
		});

		test('does not replace a pivoted filter on the same field and op, adds a sibling instead', () => {
			const pivoted = { op: 'in', content: { fieldName: 'donors.age', value: [10] }, pivot: 'donors' };
			const result = SqonBuilder.from({ op: 'and', content: [pivoted] }).setFilter('donors.age', 'in', [20]).toValue();
			assert.deepEqual(result, {
				op: 'and',
				content: [pivoted, { op: 'in', content: { fieldName: 'donors.age', value: [20] } }],
			});
		});
	});

	suite('removeFilter()', () => {
		test('removes all filters on a field when only fieldName is given', () => {
			const result = SqonBuilder.in('status', ['active']).gt('age', 18).removeFilter('status').toValue();
			assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 18 } });
		});

		test('removes a filter matching fieldName and op', () => {
			const result = SqonBuilder.in('status', ['active']).gt('age', 18).removeFilter('age', 'gt').toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active'] } });
		});

		test('removes specific values from an in filter, keeping the rest', () => {
			const result = SqonBuilder.in('status', ['active', 'pending', 'closed']).removeFilter('status', 'in', ['closed']).toValue();
			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active', 'pending'] } });
		});

		test('removes the entire filter when all values are removed', () => {
			const result = SqonBuilder.in('status', ['active']).gt('age', 18).removeFilter('status', 'in', ['active']).toValue();
			assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 18 } });
		});

		test('returns an empty sqon when the only filter is removed', () => {
			const result = SqonBuilder.in('status', ['active']).removeFilter('status').toValue();
			assert.deepEqual(result, { op: 'and', content: [] });
		});

		test('is a no-op when fieldName does not match', () => {
			const before = SqonBuilder.in('status', ['active']).toValue();
			const result = SqonBuilder.in('status', ['active']).removeFilter('type').toValue();
			assert.deepEqual(result, before);
		});
	});

	suite('removeExactFilter()', () => {
		test('removes a filter that exactly matches op, fieldName, and value', () => {
			const filter = { op: 'in' as const, content: { fieldName: 'status', value: ['active'] } };
			const result = SqonBuilder.in('status', ['active']).gt('age', 18).removeExactFilter(filter).toValue();
			assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 18 } });
		});

		test('is a no-op when the filter value does not match (order-independent)', () => {
			const filter = { op: 'in' as const, content: { fieldName: 'status', value: ['pending'] } };
			const before = SqonBuilder.in('status', ['active']).toValue();
			const result = SqonBuilder.in('status', ['active']).removeExactFilter(filter).toValue();
			assert.deepEqual(result, before);
		});

		test('matches array values regardless of order', () => {
			const filter = { op: 'in' as const, content: { fieldName: 'status', value: ['b', 'a'] } };
			const result = SqonBuilder.in('status', ['a', 'b']).gt('age', 18).removeExactFilter(filter).toValue();
			assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 18 } });
		});

		test('returns an empty sqon when the only node matches', () => {
			const filter = { op: 'in' as const, content: { fieldName: 'status', value: ['active'] } };
			const result = SqonBuilder.in('status', ['active']).removeExactFilter(filter).toValue();
			assert.deepEqual(result, { op: 'and', content: [] });
		});
	});

	suite('SqonBuilderHandle type', () => {
		test('can be used to type a variable holding a builder instance', () => {
			const b: SqonBuilderHandle = SqonBuilder.in('status', ['active']);
			assert.ok(b.toValue());
		});
	});
});
