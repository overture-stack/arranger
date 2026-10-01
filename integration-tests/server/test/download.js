import assert from 'node:assert/strict';
import { test } from 'node:test';

import axios from 'axios';

/*
 * Exports through the server's own download route, against the real search engine, posted the way
 * the stock UI posts them. The row expectations are derived from the fixture: the suites'
 * server-side filter permits every document not marked access_denied, and a server started with no
 * filter permits every document.
 */

const NAME_COLUMN = {
	accessor: 'name',
	displayName: 'Name',
	fieldName: 'name',
	jsonPath: null,
	show: true,
	type: 'keyword',
};

const isDenied = ({ _source }) => _source.access_denied === true;
const namesOf = (documents) => documents.map(({ _source }) => _source.name);
const inIdOrder = (documents) =>
	[...documents].sort((first, second) => (first._id < second._id ? -1 : first._id > second._id ? 1 : 0));

/**
 * Guards the precondition the access-control assertions rest on: a denied document exists, under an
 * `_id` no other document shares. Indexing keys on `_id`, so a shared one is overwritten and the
 * filter has nothing to exclude, which lets an exclusion assertion pass with no filter at all.
 */
const deniedDocumentsIn = (documents) => {
	const deniedDocuments = documents.filter(isDenied);

	assert.ok(deniedDocuments.length > 0, 'the fixture must hold a denied document for these tests to exclude');
	for (const denied of deniedDocuments) {
		assert.equal(
			documents.filter(({ _id }) => _id === denied._id).length,
			1,
			`the denied document ${denied._source.name} needs an _id of its own, or indexing overwrites it`,
		);
	}

	return deniedDocuments;
};

/**
 * Posts one TSV file with a single name column as the stock UI's form does: `params` as JSON text
 * beside the key and headers fields it always sends, an empty top-level name, the catalogue's
 * document type, and the base exporter's `maxRows` of 0, meaning "the server's limit". Never throws
 * on a status: it asserts a 200 and a plain-text body, and returns the body whole.
 */
const download = async ({ documentType, downloadUrl, file = {} }) => {
	const response = await axios.post(
		downloadUrl,
		new URLSearchParams({
			downloadKey: 'integration-download',
			httpHeaders: '{}',
			params: JSON.stringify({
				fileName: '',
				files: [
					{
						columns: [NAME_COLUMN],
						documentType,
						fileName: 'models.tsv',
						fileType: 'tsv',
						maxRows: 0,
						sqon: null,
						...file,
					},
				],
			}),
		}),
		{ responseType: 'text', transformResponse: (body) => body, validateStatus: () => true },
	);

	assert.equal(response.status, 200, `expected a 200, got ${response.status}: ${response.data}`);
	assert.match(response.headers['content-type'] ?? '', /^text\/plain/);

	return response.data;
};

/** Splits a non-empty TSV body into its header and data rows, each of which must end in a newline. */
const rowsOf = (body) => {
	assert.ok(body.endsWith('\n'), `every row, the last included, ends in a newline; got ${JSON.stringify(body)}`);

	const [header, ...rows] = body.slice(0, -1).split('\n');

	return { header, rows };
};

const nameSqon = (names) => ({ content: [{ content: { fieldName: 'name', value: names }, op: 'in' }], op: 'and' });

/** For a server started with no filter at all: the denied document is exported like any other. */
export const downloadWithoutAccessControl = ({ documents, documentType, downloadUrl }) => {
	test('1.exports every stored document, the denied one included, when no filter is configured', async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When every document is exported
		const { header, rows } = rowsOf(await download({ documentType, downloadUrl }));

		// Then the header comes first, then one row per stored document, the denied one with them
		assert.equal(header, 'Name');
		assert.deepEqual([...rows].sort(), namesOf(documents).sort());
	});

	test('2.exports the denied document when a request names it alone and no filter is configured', async () => {
		// Given the denied document from the fixture
		const [denied] = deniedDocumentsIn(documents);

		// When the export asks for it by name
		const { header, rows } = rowsOf(
			await download({ documentType, downloadUrl, file: { sqon: nameSqon([denied._source.name]) } }),
		);

		// Then it is exported, so the filtered suites' empty answer to the same request is the filter's doing
		assert.equal(header, 'Name');
		assert.deepEqual(rows, [denied._source.name]);
	});
};

export default ({ documents, documentType, downloadUrl }) => {
	test('1.exports exactly the documents the server-side filter permits, header first', async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When every document is exported
		const { header, rows } = rowsOf(await download({ documentType, downloadUrl }));

		// Then one row per permitted document follows the header, and no row for the denied one
		assert.equal(header, 'Name');
		assert.deepEqual([...rows].sort(), namesOf(documents.filter((document) => !isDenied(document))).sort());
	});

	test('2.exports no row for the denied document when a request names it beside a permitted one', async () => {
		// Given the denied document and one permitted document from the fixture
		const [denied] = deniedDocumentsIn(documents);
		const permitted = documents.find((document) => !isDenied(document));

		// When the export asks for both by name
		const { rows } = rowsOf(
			await download({
				documentType,
				downloadUrl,
				file: { sqon: nameSqon([denied._source.name, permitted._source.name]) },
			}),
		);

		// Then only the permitted one is exported: the client's sqon narrowed, and the filter still applied
		assert.deepEqual(rows, [permitted._source.name]);
	});

	test('3.pages through the permitted documents one at a time, each exactly once, in _id order', async () => {
		// Given the fixture, whose denied document does not sort first by _id, so a page after the first
		// would carry it if paging dropped the filter after the first search
		const [denied] = deniedDocumentsIn(documents);
		assert.notEqual(inIdOrder(documents)[0]._id, denied._id, 'the denied document must not be the first by _id');

		// When every document is exported one per search page
		const { rows } = rowsOf(await download({ documentType, downloadUrl, file: { chunkSize: 1 } }));

		// Then every permitted document arrives once, in _id order, with no page repeated or dropped
		assert.deepEqual(rows, namesOf(inIdOrder(documents.filter((document) => !isDenied(document)))));
	});

	test('4.answers a request naming only the denied document with an empty export, as for any zero-row export', async () => {
		// Given the denied document from the fixture
		const [denied] = deniedDocumentsIn(documents);

		// When the export asks for it alone by name
		const body = await download({ documentType, downloadUrl, file: { sqon: nameSqon([denied._source.name]) } });

		// Then the export succeeds with nothing in it, not even the header, exactly as when nothing matches
		assert.equal(body, '');
	});
};
