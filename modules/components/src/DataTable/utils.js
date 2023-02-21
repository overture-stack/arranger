import { withProps } from 'recompose';
import { isNil, sortBy } from 'lodash';

import columnTypes from './columnTypes';

export function getSingleValue(data) {
	if (typeof data === 'object' && data) {
		return getSingleValue(Object.values(data)[0]);
	} else {
		return data;
	}
}

export function normalizeColumns({
	columns = [],
	customTypes,
	customColumns = [],
	customTypeConfigs = {},
}) {
	const types = {
		...columnTypes,
		...customTypes,
	};

	const mappedColumns = columns
		.map((column) => {
			const customCol =
				customColumns.find((cc) => cc.content.fieldName === column.fieldName)?.content || {};

			return {
				...column,
				show: typeof column.show === 'boolean' ? column.show : false,
				Cell: column.Cell || types[column.isArray ? 'list' : column.type],
				hasCustomType: isNil(column.hasCustomType)
					? !!(customTypes || {})[column.type]
					: column.hasCustomType,
				...(!column.accessor && !column.id ? { id: column.fieldName } : {}),
				...(customTypeConfigs[column.type] || {}),
				...customCol,
			};
		})
		.filter((x) => x.show || x.canChangeShow);

	// filter out override columns
	const filteredCustomCols = customColumns.filter(
		(cc) => !mappedColumns.some((col) => col.fieldName === cc.content.fieldName),
	);

	return sortBy(filteredCustomCols, 'index').reduce(
		(arr, { index, content }, i) => [...arr.slice(0, index + i), content, ...arr.slice(index + i)],
		mappedColumns,
	);
}

export const withNormalizedColumns = withProps(
	({ config = {}, customTypes, customColumns, customTypeConfigs }) => ({
		config: {
			...config,
			columns: normalizeColumns({
				columns: config.columns,
				customTypes,
				customColumns,
				customTypeConfigs,
			}),
		},
	}),
);
