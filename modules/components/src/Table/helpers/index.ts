import { useEffect, useState } from 'react';
import { createTable, useTableInstance, ColumnDef, getCoreRowModel } from '@tanstack/react-table';

import { UseTableDataProps } from '@/Table/types';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { makeTableColumns } from './columns';
import { useTableContext } from './context';

const table = createTable();

export const useTableData = ({
  columnTypes: customColumnTypes,
  disableRowSelection: customDisableRowSelection,
}: UseTableDataProps) => {
  const {
    hasShowableColumns,
    hasVisibleColumns,
    isLoading,
    keyField,
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
  const [tableColumns, setTableColumns] = useState<ColumnDef<any>[]>([]);

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
        table,
        total,
        visibleColumns,
      }),
    );
  }, [customColumnTypes, allowRowSelection, themeColumnTypes, visibleColumnsDict, total]);

  const tableInstance = useTableInstance(table, {
    columns: tableColumns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index, parent) =>
      `${parent ? [parent.id, row[keyField]].join('.') : row[keyField]}`,
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
