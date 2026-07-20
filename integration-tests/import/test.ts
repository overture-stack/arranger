import { describe, expect, test } from '@jest/globals';
import { Query, Aggregations, SQONViewer, Table } from '@overture-stack/arranger-components';
import { configs, elastic } from '@overture-stack/arranger-types';
import { SqonBuilder, SqonSchema, SQON_SCHEMA_VERSION } from '@overture-stack/sqon';

// NOTE: @overture-stack/arranger-graphql-router is pure ESM and requires a separate
// test runner (see tech-debt: ESM import test gap).
//
// NOTE: These tests use file: workspace deps and therefore exercise local build output,
// not the published npm tarball. Publishing regressions (e.g. file: paths in package.json)
// are caught by `npm run release:check` (scripts/verify-pack.mjs), not here.

describe('integration-tests/import', () => {
	test('1.importing @overture-stack/arranger-components modules', (done) => {
		expect(Query).toBeDefined();
		expect(Aggregations).toBeDefined();
		expect(SQONViewer).toBeDefined();
		expect(Table).toBeDefined();
		done();
	});

	test('imports @overture-stack/arranger-types config and elastic exports', () => {
		expect(configs.configRequiredProperties).toBeDefined();
		expect(configs.configOptionalProperties).toBeDefined();
		expect(elastic.esToAggTypesMap).toBeDefined();
	});

	test('imports @overture-stack/sqon CJS exports', () => {
		expect(SqonBuilder).toBeDefined();
		expect(SqonSchema).toBeDefined();
		expect(typeof SQON_SCHEMA_VERSION).toBe('string');
	});
});
