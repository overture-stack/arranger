import { ReactNode, useEffect, useState } from 'react';
import {
	useReactTable,
	ColumnDef,
	getCoreRowModel,
	SortingState,
	OnChangeFn,
} from '@tanstack/react-table';
import { merge } from 'lodash';

import { UseTableDataProps } from '@/Table/types';
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

export const useTableData = ({
	columnTypes: customColumnTypes,
	disableColumnResizing: customDisableColumnResizing,
	disableRowSelection: customDisableRowSelection,
	disableRowSorting: customDisableRowSorting,
}: UseTableDataProps) => {
	const {
		defaultSorting,
		hasShowableColumns,
		hasVisibleColumns,
		isLoading,
		keyFieldName,
		missingProvider,
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
				disableColumnResizing: themeDisableColumnResizing,
				disableRowSelection: themeDisableRowSelection,
				disableRowSorting: themeDisableRowSorting,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - useTableData' });

	const allowColumnResizing = !(customDisableColumnResizing || themeDisableColumnResizing);
	const allowRowSelection = !(customDisableRowSelection || themeDisableRowSelection);
	const allowRowSorting = !(customDisableRowSorting || themeDisableRowSorting);
	const [tableColumns, setTableColumns] = useState<ColumnDef<unknown, string>[]>([]);

	useEffect(() => {
		const visibleColumns = Object.values(visibleColumnsDict);
		setTableColumns(
			makeTableColumns({
				allowRowSelection,
				// these column customisations are added over Arranger's default column types
				columnTypes: merge(
					{ all: { size: 80 } }, // the column defaults
					themeColumnTypes, // first we account for the themed columns
					customColumnTypes, // then prioritise the ones given directly into the table
					// this is useful if there are multiple sibling tables with different "settings"
				),
				total,
				visibleColumns,
			}),
		);
	}, [customColumnTypes, allowRowSelection, themeColumnTypes, visibleColumnsDict, total]);

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
					? [parent.id, (row as Record<string, any>)[keyFieldName]].join('.')
					: (row as Record<string, any>)[keyFieldName]
			}`,
		manualSorting: true,
		onRowSelectionChange: setSelectedRowsDict,
		onSortingChange,
		state: {
			...(allowRowSelection && { rowSelection: selectedRowsDict }),
			...(allowRowSorting && {
				// sorting: sorting.map(({ desc, fieldName }) => ({ desc, id: fieldName })),
				sorting: reactTableSorting,
			}),
		},
	});

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
