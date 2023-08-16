import {
	ColumnDef,
	getCoreRowModel,
	OnChangeFn,
	SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { merge } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';

import { SELECTION_COLUMN_ID, UseTableDataProps } from '@/Table/types';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { makeTableColumns } from './columns';
import { useTableContext } from './context';

export const getSingleValue = (data: Record<string, any> | ReactNode): ReactNode => {
	if (typeof data === 'object' && data) {
		return getSingleValue(Object.values(data)[0]);
	} else {
		return data;
	}
};

const defaultSelectionColumnWidth = 28;

export const useTableData = ({
	columnTypes: customColumnTypes,
	defaultColumnWidth: customColumnWidth,
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

	const [reactTableSorting, setReactTableSorting] = useState<SortingState>([]);

	const onSortingChange: OnChangeFn<SortingState> = (handleSorting) => {
		if (typeof handleSorting === 'function') {
			const newReactTableSorting = handleSorting(reactTableSorting);

			// update the data context for other Arranger components
			setSorting(
				newReactTableSorting.length
					? newReactTableSorting.map(({ id, desc }) => ({ fieldName: id, desc }))
					: defaultSorting,
			);

			// update react-table's internal state
			setReactTableSorting(newReactTableSorting);
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
		getRowId: (row, index, parent) =>
			// TODO: figure out how to avoid needing type cohercion for "row"
			`${
				parent
					? [parent.id, (row as Record<string, any>)[rowIdFieldName]].join('.')
					: (row as Record<string, any>)[rowIdFieldName]
			}`,
		manualSorting: true,
		onRowSelectionChange: setSelectedRowsDict,
		onSortingChange,
		sortDescFirst: false,
		state: {
			...(allowRowSelection && { rowSelection: selectedRowsDict }),
			...(allowRowSorting && {
				// sorting: sorting.map(({ desc, fieldName }) => ({ desc, id: fieldName })),
				sorting: reactTableSorting,
			}),
		},
	});

	useEffect(() => {
		const visibleColumns = Object.values(visibleColumnsDict);
		const visibleColumnsCount = visibleColumns.length;
		const actualTableWidth =
			visibleTableWidth - (allowRowSelection ? defaultSelectionColumnWidth : 0);
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

export * from './cells';
export * from './columns';
export * from './context';
