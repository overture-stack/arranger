import { exportSortOf, saveTSV } from './helpers.js';

/** A document recording each form the download helper submits, and the values its inputs hold. */
const recordingDocument = () => {
	/** @type {Record<string, string>[]} */
	const submitted = [];
	/** @param {string} tagName */
	const make = (tagName) => {
		/** @type {any} */
		const element = {
			children: [],
			parent: null,
			style: {},
			tagName,
			/** @param {any} child */
			appendChild(child) {
				child.parent = element;
				element.children.push(child);
				return child;
			},
			remove() {
				if (element.parent) {
					element.parent.children = element.parent.children.filter((child) => child !== element);
				}
			},
			submit() {
				submitted.push(
					Object.fromEntries(element.children.map((/** @type {any} */ input) => [input.name, input.value])),
				);
			},
		};
		return element;
	};

	return {
		body: make('BODY'),
		createElement: (/** @type {string} */ tagName) => make(tagName.toUpperCase()),
		submitted,
	};
};

describe('exportSortOf', () => {
	test("sends an export in the table's own order, column by column", () => {
		expect(
			exportSortOf([
				{ desc: true, fieldName: 'age' },
				{ desc: false, fieldName: 'donor_id' },
			]),
		).toEqual([
			{ fieldName: 'age', order: 'desc' },
			{ fieldName: 'donor_id', order: 'asc' },
		]);
	});

	test('sends no order for a table sorted by nothing', () => {
		expect(exportSortOf([])).toBeUndefined();
		expect(exportSortOf()).toBeUndefined();
	});
});

describe('saveTSV', () => {
	/** @type {ReturnType<typeof recordingDocument>} */
	let page;
	/** @type {any} */
	const globals = globalThis;

	beforeEach(() => {
		page = recordingDocument();
		globals.document = page;
	});

	afterEach(() => {
		delete globals.document;
	});

	/** @param {Record<string, unknown>} extra */
	const fileWith = (extra) => ({
		allColumnsDict: {},
		columns: [{ accessor: 'donor_id', displayName: 'Donor ID', fieldName: 'donor_id', show: true }],
		documentType: 'donor',
		fileName: 'donors.tsv',
		fileType: 'tsv',
		maxRows: 0,
		sqon: null,
		valueWhenEmpty: '--',
		...extra,
	});

	test("sends each file's sort as given", async () => {
		const sort = [{ fieldName: 'age', order: 'desc' }];

		await saveTSV(/** @type {any} */ ({ files: [fileWith({ sort })], url: '/donor/download' }));

		const params = page.submitted[0]?.params ?? '{}';
		expect(JSON.parse(params).files[0].sort).toEqual(sort);
	});

	test('sends a file given no sort without one', async () => {
		await saveTSV(/** @type {any} */ ({ files: [fileWith({})], url: '/donor/download' }));

		const params = page.submitted[0]?.params ?? '{}';
		expect(JSON.parse(params).files[0]).not.toHaveProperty('sort');
	});
});
