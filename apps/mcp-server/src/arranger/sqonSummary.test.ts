import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type SqonNode } from '@overture-stack/sqon';

import { countFilterClauses, summarizeSqon, type SummaryFields } from '#arranger/sqonSummary.js';

const fields: SummaryFields = {
	'donor.sex': { displayName: 'Biological Sex' },
	'donor.age_at_diagnosis': { displayName: 'Age at Diagnosis' },
	study: { displayName: 'Study' },
};

const leaf = (op: string, fieldName: string, value: unknown): SqonNode =>
	({ op, content: { fieldName, value } }) as unknown as SqonNode;

const group = (op: 'and' | 'or' | 'not', content: SqonNode[]): SqonNode => ({ op, content }) as unknown as SqonNode;

suite('summarizeSqon', () => {
	suite('field operators', () => {
		test('describes "in" as an is-one-of comparison', () => {
			const summary = summarizeSqon(leaf('in', 'study', ['A', 'B']), fields);
			assert.equal(summary, 'Study is "A" or "B"');
		});

		test('describes "not-in" as an exclusion', () => {
			const summary = summarizeSqon(leaf('not-in', 'study', ['A']), fields);
			assert.equal(summary, 'Study is not "A"');
		});

		test('describes "some-not-in" as an exclusion', () => {
			const summary = summarizeSqon(leaf('some-not-in', 'study', ['A']), fields);
			assert.equal(summary, 'Study is not "A"');
		});

		test('describes "all" as requiring every value', () => {
			const summary = summarizeSqon(leaf('all', 'study', ['A', 'B']), fields);
			assert.equal(summary, 'Study includes all of "A" or "B"');
		});

		test('describes each range operator with its own wording', () => {
			const age = 'donor.age_at_diagnosis';
			assert.equal(summarizeSqon(leaf('gt', age, 70), fields), 'Age at Diagnosis is greater than 70');
			assert.equal(summarizeSqon(leaf('gte', age, 70), fields), 'Age at Diagnosis is at least 70');
			assert.equal(summarizeSqon(leaf('lt', age, 70), fields), 'Age at Diagnosis is less than 70');
			assert.equal(summarizeSqon(leaf('lte', age, 70), fields), 'Age at Diagnosis is at most 70');
		});

		test('describes "between" as an inclusive range', () => {
			const summary = summarizeSqon(leaf('between', 'donor.age_at_diagnosis', [40, 60]), fields);
			assert.equal(summary, 'Age at Diagnosis is between 40 and 60');
		});

		test('describes "wildcard" as a pattern match, naming every field it searches', () => {
			const wildcard = { op: 'wildcard', content: { fieldNames: ['study', 'donor.sex'], value: '*A*' } };
			const summary = summarizeSqon(wildcard as unknown as SqonNode, fields);
			assert.equal(summary, 'study, donor.sex matches "*A*"');
		});

		test('falls back to a literal rendering for an operator it does not know', () => {
			const summary = summarizeSqon(leaf('made-up', 'study', ['A']), fields);
			assert.equal(summary, 'Study made-up "A"');
		});
	});

	suite('values', () => {
		test('quotes string values and leaves numbers and booleans bare', () => {
			assert.equal(summarizeSqon(leaf('in', 'study', ['A']), fields), 'Study is "A"');
			assert.equal(summarizeSqon(leaf('in', 'study', [1]), fields), 'Study is 1');
			assert.equal(summarizeSqon(leaf('in', 'study', [true]), fields), 'Study is true');
		});

		test('joins multiple values with "or"', () => {
			const summary = summarizeSqon(leaf('in', 'study', ['A', 'B', 'C']), fields);
			assert.equal(summary, 'Study is "A" or "B" or "C"');
		});

		test('renders a scalar value that was not wrapped in an array', () => {
			const summary = summarizeSqon(leaf('in', 'study', 'A'), fields);
			assert.equal(summary, 'Study is "A"');
		});
	});

	suite('field labels', () => {
		test('prefers the catalogue display name over the field name', () => {
			const summary = summarizeSqon(leaf('in', 'donor.sex', ['Male']), fields);
			assert.equal(summary, 'Biological Sex is "Male"');
		});

		test('falls back to the field name when the catalogue has no display name for it', () => {
			const summary = summarizeSqon(leaf('in', 'donor.unknown_field', ['x']), fields);
			assert.equal(summary, 'donor.unknown_field is "x"');
		});

		test('falls back to the field name when no field metadata is supplied at all', () => {
			const summary = summarizeSqon(leaf('in', 'study', ['A']));
			assert.equal(summary, 'study is "A"');
		});
	});

	suite('combinations', () => {
		test('joins the clauses of a root "and" group without wrapping them in brackets', () => {
			const sqon = group('and', [leaf('in', 'donor.sex', ['Male']), leaf('gte', 'donor.age_at_diagnosis', 40)]);
			assert.equal(summarizeSqon(sqon, fields), 'Biological Sex is "Male" AND Age at Diagnosis is at least 40');
		});

		test('joins the clauses of a root "or" group without wrapping them in brackets', () => {
			const sqon = group('or', [leaf('in', 'study', ['A']), leaf('in', 'study', ['B'])]);
			assert.equal(summarizeSqon(sqon, fields), 'Study is "A" OR Study is "B"');
		});

		test('brackets a nested group so the precedence of a mixed query is unambiguous', () => {
			const sqon = group('and', [
				leaf('in', 'donor.sex', ['Male']),
				group('or', [leaf('in', 'study', ['A']), leaf('in', 'study', ['B'])]),
			]);
			assert.equal(summarizeSqon(sqon, fields), 'Biological Sex is "Male" AND (Study is "A" OR Study is "B")');
		});

		test('describes a "not" group as a negation of everything inside it', () => {
			const sqon = group('not', [leaf('gt', 'donor.age_at_diagnosis', 70)]);
			assert.equal(summarizeSqon(sqon, fields), 'NOT (Age at Diagnosis is greater than 70)');
		});

		test('describes a negated clause nested inside an "and" group', () => {
			const sqon = group('and', [
				leaf('in', 'donor.sex', ['Male']),
				group('not', [leaf('gt', 'donor.age_at_diagnosis', 70)]),
			]);
			assert.equal(
				summarizeSqon(sqon, fields),
				'Biological Sex is "Male" AND NOT (Age at Diagnosis is greater than 70)',
			);
		});

		test('describes an empty root SQON as matching everything', () => {
			assert.equal(summarizeSqon(group('and', []), fields), 'no filters (matches every document)');
		});
	});
});

suite('countFilterClauses', () => {
	test('counts a bare leaf as one clause', () => {
		assert.equal(countFilterClauses(leaf('in', 'study', ['A'])), 1);
	});

	test('counts an empty root SQON as no clauses', () => {
		assert.equal(countFilterClauses(group('and', [])), 0);
	});

	test('counts every leaf in a flat group', () => {
		const sqon = group('and', [leaf('in', 'study', ['A']), leaf('in', 'donor.sex', ['Male'])]);
		assert.equal(countFilterClauses(sqon), 2);
	});

	test('counts leaves nested at any depth', () => {
		const sqon = group('and', [
			leaf('in', 'study', ['A']),
			group('or', [leaf('in', 'donor.sex', ['Male']), group('not', [leaf('gt', 'donor.age_at_diagnosis', 70)])]),
		]);
		assert.equal(countFilterClauses(sqon), 3);
	});

	test('counts a negated clause once, not twice for its "not" wrapper', () => {
		assert.equal(countFilterClauses(group('not', [leaf('gt', 'donor.age_at_diagnosis', 70)])), 1);
	});
});
