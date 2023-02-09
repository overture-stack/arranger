import { ReactNode, useEffect, useState } from 'react';
import { useReactTable, ColumnDef, getCoreRowModel } from '@tanstack/react-table';
/* Column,
  Table as ReactTable,
  PaginationState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  OnChangeFn,
  flexRender, */

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
	disableRowSelection: customDisableRowSelection,
}: UseTableDataProps) => {
	const {
		hasShowableColumns,
		hasVisibleColumns,
		isLoading,
		keyFieldName,
		missingProvider,
		selectedRowsDict,
		setSelectedRowsDict,
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
				disableRowSelection: themeDisableRowSelection,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - useTableData' });

	const allowRowSelection = !(customDisableRowSelection || themeDisableRowSelection);
	const [tableColumns, setTableColumns] = useState<ColumnDef<unknown, unknown>[]>([]);

	useEffect(() => {
		const visibleColumns = Object.values(visibleColumnsDict);
		setTableColumns(
			makeTableColumns({
				allowRowSelection,
				// these column customisations are added over Arranger's default column types
				columnTypes: {
					...themeColumnTypes, // first we account for the themed columns
					...customColumnTypes, // then prioritise the ones given directly into the table
					// this is useful if there are multiple sibling tables with different "settings"
				},
				total,
				visibleColumns,
			}),
		);
	}, [customColumnTypes, allowRowSelection, themeColumnTypes, visibleColumnsDict, total]);

	const tableInstance = useReactTable({
		columns: tableColumns,
		data: tableData,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row, index, parent) =>
			`${parent ? [parent.id, row[keyFieldName]].join('.') : row[keyFieldName]}`,
		...(allowRowSelection && {
			state: {
				rowSelection: selectedRowsDict,
			},
			onRowSelectionChange: setSelectedRowsDict,
		}),
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
