import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { aggregationsTypenames } from '#arranger';
import type { ChartQuery } from '../components/Provider/chartsContextTypes';
import { generateChartsQuery } from './generateCharts';

const aggregationField = (fieldName: string): ChartQuery => ({
	fieldName,
	gqlTypename: aggregationsTypenames.Aggregations,
});

suite('generateChartsQuery', () => {
	test('returns null when there are no fields and no network requirement', () => {
		const result = generateChartsQuery({
			documentType: 'file',
			queryFields: new Map(),
			networkQueryFields: new Map(),
			isRequireNetworkSearch: false,
		});

		assert.equal(result, null);
	});

	test('local fields only: declares $filters but not $nodesFilter, and includes no network block', () => {
		const result = generateChartsQuery({
			documentType: 'file',
			queryFields: new Map([['donor_age', aggregationField('donor_age')]]),
			networkQueryFields: new Map(),
			isRequireNetworkSearch: false,
		});

		assert.ok(result);
		assert.match(result, /query ChartsQuery\(\$filters: JSON\)/);
		assert.ok(!result.includes('$nodesFilter'));
		assert.ok(!result.includes('network ('));
	});

	test('isRequireNetworkSearch without network aggregation fields: declares $nodesFilter and includes a nodes-only network block', () => {
		const result = generateChartsQuery({
			documentType: 'file',
			queryFields: new Map(),
			networkQueryFields: new Map(),
			isRequireNetworkSearch: true,
		});

		assert.ok(result);
		assert.match(result, /query ChartsQuery\(\$filters: JSON, \$nodesFilter: \[String\]\)/);
		assert.ok(result.includes('network ('));
		assert.ok(result.includes('nodesFilter: $nodesFilter'));
		assert.ok(!result.includes('aggregations {'));
	});

	test('local fields and network aggregation fields together: both blocks appear in one query', () => {
		const result = generateChartsQuery({
			documentType: 'file',
			queryFields: new Map([['donor_age', aggregationField('donor_age')]]),
			networkQueryFields: new Map([['donor_gender', aggregationField('donor_gender')]]),
			isRequireNetworkSearch: false,
		});

		assert.ok(result);
		assert.match(result, /query ChartsQuery\(\$filters: JSON, \$nodesFilter: \[String\]\)/);
		assert.ok(result.includes('donor_age'));
		assert.ok(result.includes('donor_gender'));
		assert.ok(result.includes('network ('));
	});

	test('a field with an unsupported gqlTypename is skipped without discarding previously accumulated fields', () => {
		const result = generateChartsQuery({
			documentType: 'file',
			queryFields: new Map([
				['donor_age', aggregationField('donor_age')],
				['unsupported_field', { fieldName: 'unsupported_field', gqlTypename: 'SomethingUnsupported' }],
			]),
			networkQueryFields: new Map(),
			isRequireNetworkSearch: false,
		});

		assert.ok(result);
		assert.ok(result.includes('donor_age'));
		assert.ok(!result.includes('unsupported_field'));
	});
});
