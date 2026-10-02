import assert from 'node:assert/strict';
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
				hits: [{ _source: { test1: 1, test2: 'txt1' } }, { _source: { test1: 2, test2: 'txt2' } }],
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
			.on('end', () => {
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
			debug: true,
			index: 'file',
		};
		const data = {
			hits: [{ _source: { test1: 1, test2: 'txt1' } }, { _source: { test1: 2, test2: 'txt2' } }],
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
							test2: [{ nestedValue: 3 }, { nestedValue: 4 }],
						},
					},
					{
						_source: {
							test1: 2,
							test2: [{ nestedValue: 1 }, { nestedValue: 2 }],
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
							test2: [{ nestedValue: 3 }, { nestedValue: 4 }],
						},
					},
					{
						_source: {
							test1: 2,
							test2: [{ nestedValue: 1 }, { nestedValue: 2 }],
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
				console.log('chunk', chunk.toString());

				rows.push(chunk.toString());
			})
			.on('end', () => {
				const headers = columnsToHeader(config);
				const actual = `${headers}\n`.concat(rows.join(''));

				console.log('actual\n', actual);
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

/*
 * The export's output is a published contract: integrations read the TSV stream as one row string
 * per chunk, header first, and split it on tabs. These pin that shape, including the quirks an
 * integration may already depend on, so a change to the paging or error handling upstream cannot
 * alter what reaches them.
 */
suite('dataToExportFormat output shape', () => {
	const DONOR_COLUMNS = [
		{ accessor: 'donor_id', displayName: 'Donor ID', fieldName: 'donor_id', show: true },
		{ accessor: 'study', displayName: 'Study', fieldName: 'study', show: true },
	];

	/** Writes `chunks` through the formatter and resolves with every chunk it yields, in order. */
	const formatChunks = ({ chunks, ...formatterArgs }) =>
		new Promise((resolve, reject) => {
			const formatter = dataToTSVStream(formatterArgs);
			const output = [];

			formatter.on('data', (chunk) => output.push(chunk));
			formatter.on('end', () => resolve(output));
			formatter.on('error', reject);

			chunks.forEach((chunk) => formatter.write(chunk));
			formatter.end();
		});

	test('yields the TSV header row as its own chunk, then one chunk per hit, each ending in a newline', async () => {
		// Given two pages of hits, as the paging export delivers them
		const chunks = [
			{
				hits: [
					{ donor_id: 'DO_01', study: 'A' },
					{ donor_id: 'DO_02', study: 'B' },
				],
				total: 3,
			},
			{ hits: [{ donor_id: 'DO_03', study: 'A' }], total: 3 },
		];

		// When they are formatted as TSV
		const output = await formatChunks({ chunks, columns: DONOR_COLUMNS });

		// Then the header comes first and once, and every hit is its own newline-terminated chunk
		assert.deepEqual(output, ['Donor ID\tStudy\n', 'DO_01\tA\n', 'DO_02\tB\n', 'DO_03\tA\n']);
	});

	test('yields nothing at all, not even a header, when no chunk arrives', async () => {
		// Given an export that matched no document, so no chunk is delivered
		// When the formatter is ended without input
		const output = await formatChunks({ chunks: [], columns: DONOR_COLUMNS });

		// Then the output is empty
		assert.deepEqual(output, []);
	});

	test('joins the rows a uniqueBy path expands one hit into with a comma, in a single chunk', async () => {
		// Given a hit holding two files, exported one row per file
		const columns = [
			DONOR_COLUMNS[0],
			{ accessor: 'files.file_id', displayName: 'File ID', fieldName: 'files.file_id', show: true },
		];
		const chunks = [
			{ hits: [{ donor_id: 'DO_01', files: [{ file_id: 'FL_01a' }, { file_id: 'FL_01b' }] }], total: 1 },
		];

		// When it is formatted with uniqueBy on the file path
		const output = await formatChunks({ chunks, columns, uniqueBy: 'files.hits.edges[].node.file_id' });

		// Then both rows arrive together in one chunk, comma-joined, ending in one newline
		assert.deepEqual(output, ['Donor ID\tFile ID\n', 'DO_01\tFL_01a,DO_01\tFL_01b\n']);
	});

	test('yields a bare newline for a hit whose uniqueBy path holds no rows', async () => {
		// Given a hit with no files, exported one row per file
		const columns = [
			DONOR_COLUMNS[0],
			{ accessor: 'files.file_id', displayName: 'File ID', fieldName: 'files.file_id', show: true },
		];
		const chunks = [{ hits: [{ donor_id: 'DO_02', files: [] }], total: 1 }];

		// When it is formatted with uniqueBy on the file path
		const output = await formatChunks({ chunks, columns, uniqueBy: 'files.hits.edges[].node.file_id' });

		// Then the hit still yields one chunk, holding only the newline
		assert.deepEqual(output, ['Donor ID\tFile ID\n', '\n']);
	});

	test('fills an absent value with valueWhenEmpty, defaulting to "--"', async () => {
		// Given a hit with no study
		const chunks = [{ hits: [{ donor_id: 'DO_01' }], total: 1 }];

		// When it is formatted with and without a custom valueWhenEmpty
		const withDefault = await formatChunks({ chunks, columns: DONOR_COLUMNS });
		const withCustom = await formatChunks({ chunks, columns: DONOR_COLUMNS, valueWhenEmpty: 'N/A' });

		// Then the empty cell carries the placeholder each time
		assert.deepEqual(withDefault, ['Donor ID\tStudy\n', 'DO_01\t--\n']);
		assert.deepEqual(withCustom, ['Donor ID\tStudy\n', 'DO_01\tN/A\n']);
	});

	// Kept as it is today, not endorsed: a real zero or false is indistinguishable from an absent
	// value in the export. Changing that is an output change, which this release does not make.
	test('writes valueWhenEmpty for a zero or false value, exactly as for an absent one', async () => {
		// Given a hit whose count is 0 and whose flag is false
		const columns = [
			DONOR_COLUMNS[0],
			{ accessor: 'count', displayName: 'Count', fieldName: 'count', show: true },
			{ accessor: 'flag', displayName: 'Flag', fieldName: 'flag', show: true },
		];
		const chunks = [{ hits: [{ count: 0, donor_id: 'DO_01', flag: false }], total: 1 }];

		// When it is formatted as TSV
		const output = await formatChunks({ chunks, columns });

		// Then both cells carry the placeholder
		assert.deepEqual(output, ['Donor ID\tCount\tFlag\n', 'DO_01\t--\t--\n']);
	});

	test('yields the JSON header object first, then one JSON object per hit, each ending in a newline', async () => {
		// Given two hits
		const chunks = [
			{
				hits: [
					{ donor_id: 'DO_01', study: 'A' },
					{ donor_id: 'DO_02', study: 'B' },
				],
				total: 2,
			},
		];

		// When they are formatted as JSON
		const output = await formatChunks({ chunks, columns: DONOR_COLUMNS, fileType: 'json' });

		// Then the header object comes first, and each line parses as one object
		assert.deepEqual(output, [
			'{"donor_id":"Donor ID","study":"Study"}\n',
			'{"donor_id":"DO_01","study":"A"}\n',
			'{"donor_id":"DO_02","study":"B"}\n',
		]);
	});
});
