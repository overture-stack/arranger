import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { addFilterClause } from '#builder/filter.js';

suite('addFilterClause', () => {
	suite('scalar filters: standalone (no existing SQON)', () => {
		test('produces an in filter leaf for a single value', () => {
			const result = addFilterClause({ fieldName: 'status', operator: 'in', value: 'active' });

			assert.deepEqual(result, { op: 'in', content: { fieldName: 'status', value: ['active'] } });
		});

		test('produces an in filter leaf for an array value', () => {
			const result = addFilterClause({ fieldName: 'status', operator: 'in', value: ['active', 'pending'] });

			assert.deepEqual(result, {
				op: 'in',
				content: { fieldName: 'status', value: ['active', 'pending'] },
			});
		});

		test('produces a gt filter leaf', () => {
			const result = addFilterClause({ fieldName: 'age', operator: 'gt', value: 30 });

			assert.deepEqual(result, { op: 'gt', content: { fieldName: 'age', value: 30 } });
		});

		test('produces a between filter leaf with a tuple value', () => {
			const result = addFilterClause({ fieldName: 'score', operator: 'between', value: [10, 90] });

			assert.deepEqual(result, { op: 'between', content: { fieldName: 'score', value: [10, 90] } });
		});

		test('produces an all filter leaf', () => {
			const result = addFilterClause({ fieldName: 'tags', operator: 'all', value: ['urgent', 'reviewed'] });

			assert.deepEqual(result, { op: 'all', content: { fieldName: 'tags', value: ['urgent', 'reviewed'] } });
		});
	});

	suite('text filters: standalone (no existing SQON)', () => {
		test('produces a wildcard filter leaf with an array of field names', () => {
			const result = addFilterClause({
				fieldNames: ['gene_name', 'synonym'],
				operator: 'wildcard',
				value: '*TP53*',
			});

			assert.deepEqual(result, {
				op: 'wildcard',
				content: { fieldNames: ['gene_name', 'synonym'], value: '*TP53*' },
			});
		});

		test('normalizes a single string fieldName to a one-element array', () => {
			const result = addFilterClause({ fieldNames: 'gene_name', operator: 'wildcard', value: '*BRCA*' });

			assert.deepEqual(result, {
				op: 'wildcard',
				content: { fieldNames: ['gene_name'], value: '*BRCA*' },
			});
		});
	});

	suite('negate', () => {
		test('wraps a scalar clause in a not combination when negate is true', () => {
			const result = addFilterClause({ fieldName: 'status', operator: 'in', value: ['withdrawn'], negate: true });

			assert.deepEqual(result, {
				op: 'not',
				content: [{ op: 'in', content: { fieldName: 'status', value: ['withdrawn'] } }],
			});
		});

		test('wraps a text clause in a not combination when negate is true', () => {
			const result = addFilterClause({ fieldNames: 'gene_name', operator: 'wildcard', value: '*BRCA*', negate: true });

			assert.deepEqual(result, {
				op: 'not',
				content: [{ op: 'wildcard', content: { fieldNames: ['gene_name'], value: '*BRCA*' } }],
			});
		});
	});

	suite('combining with an existing SQON', () => {
		const existing = { op: 'in' as const, content: { fieldName: 'status', value: ['active'] } };

		test('combines with an existing leaf using and by default', () => {
			const result = addFilterClause({ fieldName: 'project', operator: 'in', value: ['TCGA'], existing });

			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'in', content: { fieldName: 'project', value: ['TCGA'] } },
				],
			});
		});

		test('combines with an existing leaf using or when specified', () => {
			const result = addFilterClause({
				fieldName: 'project',
				operator: 'in',
				value: ['ICGC'],
				existing,
				combination: 'or',
			});

			assert.deepEqual(result, {
				op: 'or',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'in', content: { fieldName: 'project', value: ['ICGC'] } },
				],
			});
		});

		test('appends to an existing and combination without double-wrapping', () => {
			const existingAnd = {
				op: 'and' as const,
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'in', content: { fieldName: 'project', value: ['TCGA'] } },
				],
			};

			const result = addFilterClause({ fieldName: 'gender', operator: 'in', value: ['female'], existing: existingAnd });

			assert.deepEqual(result, {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'status', value: ['active'] } },
					{ op: 'in', content: { fieldName: 'project', value: ['TCGA'] } },
					{ op: 'in', content: { fieldName: 'gender', value: ['female'] } },
				],
			});
		});
	});
});
