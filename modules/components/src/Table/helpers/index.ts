import {
	getCoreRowModel,
	useReactTable,
	type ColumnDef,
	type OnChangeFn,
	type SortingState,
} from '@tanstack/react-table';
import { get, merge } from 'lodash-es';
import { type ReactNode, useEffect, useState } from 'react';

import { SELECTION_COLUMN_ID, type UseTableDataProps } from '#Table/types.js';
import { useThemeContext } from '#ThemeContext/index.js';
import type { ColumnSortingInterface } from '#types.js';
import { emptyObj } from '#utils/noops.js';

import { makeTableColumns } from './columns.js';
import { useTableContext } from './context.js';

export const getSingleValue = (data: Record<string, unknown> | ReactNode): ReactNode => {
	if (typeof data === 'object' && data) {
		return getSingleValue(Object.values(data)[0]);
	} else {
		return data;
	}
};

const defaultSelectionColumnWidth = 28;

const sanitizeCustomSortingDesc = (sortingArray) => {
	return (sortingArray || []).map((field) => ({ ...field, desc: field.desc || false }));
};

type SortingConverter = <T extends 'ReactTable' | 'Arranger'>(
	sortingArray: T extends 'ReactTable' ? ColumnSortingInterface[] : SortingState,
	direction: T,
) => T extends 'ReactTable' ? SortingState : ColumnSortingInterface[];

const convertSorting: SortingConverter = (sortingArray, direction) => {
	return sanitizeCustomSortingDesc(sortingArray).map((field) => ({
		desc: field.desc,
		...(direction === 'ReactTable' ? { id: field.fieldName } : { fieldName: field.id }),
	})) as any; // because TS goes stupid with array methods
};

export const useTableData = ({
	columnTypes: customColumnTypes,
	defaultColumnWidth: customColumnWidth,
	defaultSorting: customDefaultSorting,
	disableColumnResizing: customDisableColumnResizing,
	disableRowSelection: customDisableRowSelection,
	disableRowSorting: customDisableRowSorting,
	visibleTableWidth,
}: UseTableDataProps) => {
	const {
		defaultSorting,
		hasShowableColumns,
		hasVisibleColumns,
		isLoading,
		missingProvider,
		rowIdFieldName,
		selectedRowsDict,
		setSelectedRowsDict,
		setSorting,
		tableData,
		total,
		visibleColumnsDict,
	} = useTableContext({
		callerName: 'Table - useTableData',
		defaultSorting: sanitizeCustomSortingDesc(customDefaultSorting),
	});

	const {
		components: {
			Table: {
				columnTypes: themeColumnTypes = emptyObj,
				defaultColumnWidth: themeColumnWidth = 100,
				disableColumnResizing: themeDisableColumnResizing,
				disableRowSelection: themeDisableRowSelection,
				disableRowSorting: themeDisableRowSorting,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - useTableData' });

	const allowColumnResizing = !(customDisableColumnResizing || themeDisableColumnResizing);
	const allowRowSelection = !(customDisableRowSelection || themeDisableRowSelection);
	const allowRowSorting = !(customDisableRowSorting || themeDisableRowSorting);
	const defaultColumnWidth = customColumnWidth || themeColumnWidth;
	const [tableColumns, setTableColumns] = useState<ColumnDef<unknown, string>[]>([]);

	const initialSortingForReactTable = convertSorting(defaultSorting, 'ReactTable');
	const [reactTableSorting, setReactTableSorting] = useState<SortingState>([]);

	const onSortingChange: OnChangeFn<SortingState> = (handleSorting) => {
		if (typeof handleSorting === 'function') {
			const newReactTableSorting = handleSorting(reactTableSorting);

			const isValidNewReactTableSorting = Array.isArray(newReactTableSorting) && newReactTableSorting.length;

			// update the data context for other Arranger components
			setSorting(isValidNewReactTableSorting ? convertSorting(newReactTableSorting, 'Arranger') : defaultSorting);

			// update react-table's internal state
			setReactTableSorting(isValidNewReactTableSorting ? newReactTableSorting : initialSortingForReactTable);
		} else {
			console.info('react-table is doing something unexpected with the sorting', handleSorting);
		}
	};

	const tableInstance = useReactTable({
		columnResizeMode: 'onChange',
		columns: tableColumns,
		data: tableData,
		enableColumnResizing: allowColumnResizing,
		enableSorting: allowRowSorting,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row, index, parent) => {
			const rowId = get(row, rowIdFieldName);
			return `${parent ? [parent.id, rowId].join('.') : rowId}`;
		},
		manualSorting: true,
		onRowSelectionChange: setSelectedRowsDict,
		onSortingChange,
		sortDescFirst: false,
		state: {
			...(allowRowSelection && { rowSelection: selectedRowsDict }),
			...(allowRowSorting && {
				sorting: reactTableSorting.length ? reactTableSorting : initialSortingForReactTable,
			}),
		},
	});

	useEffect(() => {
		const visibleColumns = Object.values(visibleColumnsDict);
		const visibleColumnsCount = visibleColumns.length;
		const actualTableWidth = visibleTableWidth - (allowRowSelection ? defaultSelectionColumnWidth : 0);
		const columnSize =
			actualTableWidth <= visibleColumnsCount * defaultColumnWidth
				? defaultColumnWidth
				: actualTableWidth / visibleColumnsCount;

		setTableColumns(
			makeTableColumns({
				allowRowSelection,
				// these column customisations are added over Arranger's default column types
				columnTypes: merge(
					// the column defaults
					{
						all: { size: columnSize },
						[SELECTION_COLUMN_ID]: { size: defaultSelectionColumnWidth },
					},
					// { all: { size: columnSize } },
					themeColumnTypes, // first we account for the themed columns
					customColumnTypes, // then prioritise the ones given directly into the table
					// this is useful if there are multiple sibling tables with different "settings"
				),
				total,
				visibleColumns,
			}),
		);
	}, [
		allowRowSelection,
		customColumnTypes,
		customColumnWidth,
		defaultColumnWidth,
		tableInstance,
		themeColumnTypes,
		themeColumnWidth,
		total,
		visibleColumnsDict,
		visibleTableWidth,
	]);

	const tableDataValues = {
		hasShowableColumns,
		hasVisibleColumns,
		allowRowSelection,
		isLoading,
		missingProvider,
		tableInstance,
	};

	return tableDataValues;
};

export * from './cells.js';
export * from './columns.js';
export * from './context.js';
