import assert from 'node:assert';
import { PassThrough } from 'node:stream';
import { suite, test } from 'node:test';

import dataToTSVStream, { dataToTSV, columnsToHeader } from '#utils/dataToExportFormat.js';

suite.skip('dataToTSV accessor columns', () => {

	test('1.should handle string accessors', (_unusedTestCtx, done) => {
		const config = {
			columns: [
				{
					accessor: 'test1',
					fieldName: 'test1',
					Header: 'Test1',
				},
				{
					accessor: 'test2',
					fieldName: 'test2',
					Header: 'Test2',
				},
			],
			data: {
				hits: [
					{ _source: { test1: 1, test2: 'txt1' } },
					{ _source: { test1: 2, test2: 'txt2' } }
				],
				total: 5,
			},
			index: 'file',
		};
		const expected = 'Test1\tTest2\n1\ttxt1\n2\ttxt2\n';

		const stream = new PassThrough();
		const rows = [];

		stream
			.on('data', (chunk) => {
				rows.push(chunk.toString());
			})
			.on("end", () => {
				const headers = columnsToHeader(config);
				const actual = `${headers}\n`.concat(rows.join(''));

				assert.deepEqual(actual, expected);
				done();
			});

		dataToTSV({ pipe: stream, ...config });
	});

	test('2.should accept valueWhenEmpty', (_unusedTestCtx, done) => {
		const config = {
			columns: [
				{
					accessor: 'test1',
					fieldName: 'test1',
					Header: 'Test1',
				},
				{
					accessor: 'test2',
					fieldName: 'test2',
					Header: 'Test2',
				},
			],
			data: {
				hits: [
					{ _source: { test1: 1, test2: 'txt1' } },
					{ _source: { test1: 2 } }, // missing test2, to test.
				],
				total: 5,
			},
			index: 'file',
			valueWhenEmpty: 'empty',
		};
		const expected = 'Test1\tTest2\n1\ttxt1\n2\tempty\n';

		const stream = new PassThrough();
		const rows = [];

		stream
			.on('data', (chunk) => {
				rows.push(chunk.toString());
			})
			.on('end', () => {
				const headers = columnsToHeader(config);
				const actual = `${headers}\n`.concat(rows.join(''));

				assert.deepEqual(actual, expected);
				done();
			});

		dataToTSV({ pipe: stream, ...config });
	});

	test('3.should stream', (_unusedTestCtx, done) => {
		const config = {
			columns: [
				{
					accessor: 'test1',
					fieldName: 'test1',
					Header: 'Test1',
				},
				{
					accessor: 'test2',
					fieldName: 'test2',
					Header: 'Test2',
				},
			],
			index: 'file',
		};
		const data = {
			hits: [
				{ _source: { test1: 1, test2: 'txt1' } },
				{ _source: { test1: 2, test2: 'txt2' } }
			],
			total: 5,
		};
		const expected = 'Test1\tTest2\n1\ttxt1\n2\ttxt2\n';

		const stream = new PassThrough();
		const actual = [];

		stream
			.pipe(dataToTSVStream(config))
			.on('data', (chunk) => {
				actual.push(chunk);
			})
			.on('end', () => {
				assert.deepEqual(actual.join(''), expected);
				done();
			})
			.write(data);
	});

	test('4.should join multiple values', (_unusedTestCtx, done) => {
		const config = {
			columns: [
				{
					accessor: 'test1',
					fieldName: 'test1',
					Header: 'Test1',
				},
				{
					fieldName: 'test2.nestedValue',
					Header: 'Test2',
					jsonPath: '$.test2.hits.edges[*].node.nestedValue',
				},
			],
			data: {
				hits: [
					{
						_source: {
							test1: 1,
							test2: [
								{ nestedValue: 3 },
								{ nestedValue: 4 },
							],
						},
					},
					{
						_source: {
							test1: 2,
							test2: [
								{ nestedValue: 1 },
								{ nestedValue: 2 },
							],
						},
					},
				],
				total: 5,
			},
			index: 'file',
		};
		const expected = 'Test1\tTest2\n1\t3, 4\n2\t1, 2\n';

		const stream = new PassThrough();
		const rows = [];

		stream
			.on('data', (chunk) => {
				rows.push(chunk.toString());
			})
			.on('end', () => {
				const headers = columnsToHeader(config);
				const actual = `${headers}\n`.concat(rows.join(''));

				assert.deepEqual(actual, expected);
				done();
			});

		dataToTSV({ pipe: stream, ...config });
	});

	test.todo('5.should accept uniqueBy', (_unusedTestCtx, done) => {
		const config = {
			columns: [
				{
					accessor: 'test1',
					fieldName: 'test1',
					Header: 'Test1',
				},
				{
					fieldName: 'test2.nestedValue',
					Header: 'Test2',
					jsonPath: '$.test2.hits.edges[*].node.nestedValue',
				},
			],
			data: {
				hits: [
					{
						_source: {
							test1: 1,
							test2: [
								{ nestedValue: 3 },
								{ nestedValue: 4 },
							],
						},
					},
					{
						_source: {
							test1: 2,
							test2: [
								{ nestedValue: 1 },
								{ nestedValue: 2 },
							],
						},
					},
				],
			},
			index: 'file',
			uniqueBy: 'test2.hits.edges[].node.nestedValue',
		};
		const expected = 'Test1\tTest2\n1\t3\n1\t4\n2\t1\n2\t2\n';

		const stream = new PassThrough();
		const rows = [];

		stream
			.on('data', (chunk) => {
				console.log("chunk", chunk.toString());

				rows.push(chunk.toString());
			})
			.on('end', () => {
				const headers = columnsToHeader(config);
				const actual = `${headers}\n`.concat(rows.join(''));

				console.log("actual\n", actual);
				console.log('expected\n', expected);

				assert.deepEqual(actual, expected);
				done();
			});

		dataToTSV({ pipe: stream, ...config });
	});

	test('6.should handle deep nested fields', (_unusedTestCtx, done) => {
		const config = {
			columns: [
				{
					accessor: 'test1',
					fieldName: 'test1',
					Header: 'Test1',
				},
				{
					fieldName: 'test2.nestedValue.nesting.nestedValue',
					Header: 'Test2',
					jsonPath: '$.test2.hits.edges[*].node.nesting.hits.edges[*].node.nestedValue',
				},
			],
			data: {
				hits: [
					{
						_source: {
							test1: 1,
							test2: [
								{
									nestedValue: 3,
								},
								{
									nestedValue: 4,
								},
							],
						},
					},
					{
						_source: {
							test1: 2,
							test2: [
								{
									nestedValue: 1,
									nesting: [
										{
											nestedValue: 1,
										},
										{
											nestedValue: 2,
										},
									],
								},
								{
									nestedValue: 2,
									nesting: [
										{
											nestedValue: 1,
										},
										{
											nestedValue: 2,
										},
									],
								},
							],
						},
					},
				],
			},
			index: 'file',
		};
		const expected = 'Test1\tTest2\n1\t\n2\t1, 2, 1, 2\n';

		const stream = new PassThrough();
		const rows = [];

		stream
			.on('data', (chunk) => {
				rows.push(chunk.toString());
			})
			.on('end', () => {
				const headers = columnsToHeader(config);
				const actual = `${headers}\n`.concat(rows.join(''));

				assert.deepEqual(actual, expected);
				done();
			});

		dataToTSV({ pipe: stream, ...config });
	});

});
