import { format, isValid, parseISO } from 'date-fns';
import { JSONPath } from 'jsonpath-plus';
import { flatten, find, get, isNil } from 'lodash-es';
import through2 from 'through2';

import { ENV_CONFIG } from '#config/index.js';

const STANDARD_DATE = 'yyyy-MM-dd';

const dateHandler = (value, { dateFormat: formatInput }) => {
	const dateFormat = formatInput ?? STANDARD_DATE; // the input could come as null, which prevents destructuring default values.

	switch (true) {
		case isNil(value):
			return '';

		case isValid(new Date(value)):
			return format(new Date(value), dateFormat);

		case isValid(parseISO(value)):
			return format(parseISO(value), dateFormat);

		case !isNaN(parseInt(value, 10)):
			return format(parseInt(value, 10), dateFormat);

		default: {
			ENV_CONFIG.DEBUG_MODE &&
				console.error('unhandled "date" in dataToExportFormat/dateHandler', value, dateFormat);
			return value;
		}
	}
};

const getAllValues = (item) => {
	if (typeof item === 'object' && !Array.isArray(item)) {
		return Object.values(item || {})
			.map(getAllValues)
			.reduce((a, b) => a.concat(b), []);
	} else {
		return item;
	}
};

const getValue = (row, column) => {
	const valueFromExtended = (value) => {
		switch (true) {
			case column?.extendedDisplayValues?.constructor === Object &&
				Object.keys(column.extendedDisplayValues).length > 0:
				return column.extendedDisplayValues[value];

			case column.isArray && Array.isArray(value):
				return value
					.map((each) => valueFromExtended(each))
					.join(';')
					.replace(';;', ';');

			case [column.displayType, column.type].includes('date'):
				return dateHandler(value, { dateFormat: column.displayFormat });

			default:
				return value;
		}
	};

	if (column.jsonPath) {
		const pathChunks = column.jsonPath.split('.hits.edges[*].node.');
		const entryPoint = pathChunks[0]?.replace('$.', '');
		const nestedRows = JSONPath({
			json: find(row, entryPoint) || row,
			path: pathChunks.join('[*].')
		});
		const valuesList = nestedRows
			.map(getAllValues)
			.reduce((a, b) => a.concat(b), [])
			.map(valueFromExtended)
			.join(', ');

		return valuesList;
	} else if (column.accessor) {
		const easyValue = get(row, column.accessor);

		if (easyValue !== undefined) {
			return valueFromExtended(easyValue);
		}

		const deepValueObj = find(row, column.accessor);
		if (deepValueObj?.[column.accessor]) {
			return valueFromExtended(deepValueObj[column.accessor]);
		}
	}

	return '';
};

const getRows = (args) => {
	const { row, data = row, paths, pathIndex = 0, columns, entities = [], beep } = args;

	if (pathIndex >= paths.length - 1) {
		const rows = columns.map((column) => {
			const entity = entities
				.slice()
				.reverse()
				.find((entity) => column.fieldName.includes(entity.fieldName));

			if (entity) {
				const newColumn = {
					...column,
					jsonPath: null,
					accessor: column.fieldName.replace(`${entity.path.join('.')}.`, ''),
				};

				const value = getValue(entity.data, newColumn);

				return value;
			} else {
				return getValue(row, column);
			}
		});

		return [rows];
	} else {
		const currentPath = paths[pathIndex];
		const rows = get(data, currentPath) || find(data, currentPath)?.[currentPath] || [];

		const rowsToFlatten = rows.map(
			(node) => {
				const aRow = getRows({
					...args,
					data: node,
					pathIndex: pathIndex + 1,
					entities: [
						...entities,
						{
							path: paths.slice(0, pathIndex + 1),
							fieldName: paths.slice(0, pathIndex + 1).join(''),
							// TODO: don't assume hits.edges.node.
							// .replace(/(\.hits.edges(node)?)/g, ''),
							data: node,
						},
					],
				});

				return aRow;
			});

		return flatten(rowsToFlatten);
	}
};

const rowToTSV = ({ row, valueWhenEmpty }) => {
	const rowValues = row
		.map((value) => {
			// replaces empty values with a custom entity
			return value || valueWhenEmpty;
		})
		.join('\t');

	return rowValues;
};

const pushToStream = (line, stream) => {
	stream.push(`${line}\n`);
};

const transformData = ({
	data: { hits },
	uniqueBy,
	columns,
	valueWhenEmpty,
	dataTransformer,
	pipe,
}) =>
	hits
		.map((row) =>
			dataTransformer({ row, uniqueBy, columns, valueWhenEmpty })
		)
		.forEach((transformedRow) =>
			pushToStream(transformedRow, pipe)
		);

export const columnsToHeader = ({ columns, extendedFieldsDict, fileType = 'tsv' }) => {
	const columnHeaders = columns.reduce((output, { accessor, displayName, fieldName, Header }) => {
		const fieldDefaultExtendedDetails = extendedFieldsDict?.[fieldName || accessor];

		return {
			...output,
			[fieldName || accessor]: displayName || Header || fieldDefaultExtendedDetails?.displayName || fieldName,
		};
	}, {});

	switch (fileType) {
		case 'json': {
			return columnHeaders;
		}

		case 'tsv': {
			return Object.values(columnHeaders).join('\t');
		}

		default:
			return '';
	}
};

const transformDataToTSV = ({ row, uniqueBy = '', columns, valueWhenEmpty }) => {
	const rows = getRows({
		columns,
		valueWhenEmpty,
		paths: uniqueBy.split('.hits.edges[].node.').filter(Boolean),
		row,
	});

	const tsvRows = rows.map((r) =>
		rowToTSV({ row: r, valueWhenEmpty })
	);

	return tsvRows;
};

export const dataToTSV = ({ columns, extendedFieldsDict, isFirst, pipe, ...args }) => {
	if (isFirst) {
		const headerRow = columnsToHeader({ columns, extendedFieldsDict, fileType: 'tsv' });
		pushToStream(headerRow, pipe);
	}

	transformData({
		isFirst,
		pipe,
		columns,
		...args,
		dataTransformer: transformDataToTSV,
	});

	// ends the stream
	pipe.end?.() || pipe.push(null);
};


/*
example args:
{ row:                                                                                                                                         [250/1767]
   { name: 'HCM-dddd-0000-C00',                                                                                                                               
	 type: '2-D: Conditionally reprogrammed cells',                                                                                                           
	 growth_rate: 5,                                                                                                                                          
	 files: [],
	 clinical_diagnosis: { clinical_tumor_diagnosis: 'Colorectal cancer' },
	 variants: [ [Object], [Object], [Object] ]
	},
  paths: [],
  columns:
   [ { fieldName: 'name',
	   accessor: 'name',
	   show: true,
	   type: 'entity',
	   sortable: true,
	   canChangeShow: true,
	   query: null,
	   jsonPath: null,
	   Header: 'Name',
	   extendedType: 'keyword',
	   extendedDisplayValues: {},
	   hasCustomType: true,
	   minWidth: 140 },
	   { fieldName: 'split_ratio',
	   accessor: 'split_ratio',
	   show: true,
	   type: 'string',
	   sortable: true,
	   canChangeShow: true,
	   query: null,
	   jsonPath: null,
	   Header: 'Split Ratio',
	   extendedType: 'keyword',
	   extendedDisplayValues: {},
	   hasCustomType: false } ],
  valueWhenEmpty: '--' }
*/
const rowToJSON = ({
	row,
	data = row,
	paths,
	pathIndex = 0,
	columns,
	valueWhenEmpty,
	entities = []
}) => {
	return (columns || [])
		.filter((col) => col.show)
		.reduce((output, col) => {
			output[[col.accessor]] = row[col.accessor] || valueWhenEmpty;
			return output;
		}, {});
};

const transformDataToJSON = ({ row, uniqueBy, columns, valueWhenEmpty }) => {
	try {
		const jsonRow = rowToJSON({
			columns,
			valueWhenEmpty,
			paths: (uniqueBy || '').split('.hits.edges[].node.').filter(Boolean),
			row,
		});

		return JSON.stringify(jsonRow);
	} catch (err) {
		ENV_CONFIG.DEBUG_MODE &&
			console.error('unhandled JSON in dataToExportFormat/transformDataToJSON', err, row);
	}
};

/**
 * This should ideally stream data as a JSON list using JSONStream
 * but as of now; in favor of simplicity; it streams each row as separate JSON object
 * and it is left up to consuming application to make a well formatted
 * JSON list from individual JSON objects
 * See https://github.com/nci-hcmi-catalog/portal/tree/master/api/src/dataExport.js for an example consumer
 * @param {*} param0
 */
export const dataToJSON = ({ isFirst, pipe, columns, ...args }) => {
	if (isFirst) {
		const headerRow = columnsToHeader({ columns, fileType: 'json' });
		pushToStream(JSON.stringify(headerRow), pipe);
	}

	transformData({
		isFirst,
		pipe,
		columns,
		...args,
		dataTransformer: transformDataToJSON,
	});
};

const dataToStream = ({ fileType = 'tsv', ...args }) => {
	switch (fileType) {
		case 'json':
			return dataToJSON(args);
		case 'tsv':
			return dataToTSV(args);
		default:
			throw new Error('Unsupported file type specified for export.');
	}
};

export default ({ columns, ctx = {}, fileType = 'tsv', index, uniqueBy, valueWhenEmpty = '--' }) => {
	let isFirst = true;
	let chunkCounts = 0;

	const extendedFieldsDict =
		ctx?.configs?.extendedFields?.reduce?.(
			(acc, { fieldName, ...extendedField }) => ({
				...acc,
				[fieldName]: extendedField,
			}),
			{},
		) || {};

	return through2.obj(function ({ hits, total }, enc, callback) {
		ENV_CONFIG.DEBUG_MODE && console.time(`esHitsToTsv_${chunkCounts}`);

		const outputStream = this;
		const args = {
			columns,
			data: { hits, total },
			extendedFieldsDict,
			fileType,
			index,
			isFirst,
			pipe: outputStream,
			uniqueBy,
			valueWhenEmpty,
		};

		dataToStream(args);

		if (isFirst) {
			isFirst = false;
		}

		callback();

		ENV_CONFIG.DEBUG_MODE && console.timeEnd(`esHitsToTsv_${chunkCounts}`);

		chunkCounts++;
	});
};
