import { describe, expect, test } from '@jest/globals';
import { Query, Aggregations, SQONViewer, Table } from '@overture-stack/arranger-components';

describe('integration-tests/import', () => {
	test('1.importing @overture-stack/arranger-components modules', (done) => {
		expect(Query).toBeDefined();
		expect(Aggregations).toBeDefined();
		expect(SQONViewer).toBeDefined();
		expect(Table).toBeDefined();
		done();
	});
});
