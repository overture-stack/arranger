const { Query, Aggregations, SQONViewer, Table } = require('@overture-stack/arranger-components');

describe('integration-tests/import', () => {
	test('1.importing @overture-stack/arranger-components modules', (done) => {
		expect(Query).toBeDefined();
		expect(Aggregations).toBeDefined();
		expect(SQONViewer).toBeDefined();
		expect(Table).toBeDefined();
		done();
	});
});
