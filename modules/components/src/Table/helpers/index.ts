import { useEffect, useMemo, useState } from 'react';
import { createTable, useTableInstance, ColumnDef, getCoreRowModel } from '@tanstack/react-table';

import { UseTableDataProps } from '@/Table/types';

import { makeTableColumns } from './columns';
import { useTableContext } from './context';

const table = createTable();

export const useTableData = ({ customCells, customHeaders }: UseTableDataProps) => {
  const { isLoading, providerMissing, tableData, visibleColumnsDict } = useTableContext({
    callerName: 'Table - useTableData',
  });
  const [tableColumns, setTableColumns] = useState<ColumnDef<any>[]>([]);

  useEffect(() => {
    const visibleColumns = Object.values(visibleColumnsDict);
    visibleColumns.length > 0 &&
      setTableColumns(makeTableColumns({ customCells, customHeaders, table, visibleColumns }));
  }, [customCells, customHeaders, visibleColumnsDict]);

  const tableInstance = useTableInstance(table, {
    columns: tableColumns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableDataValues = useMemo(
    () => ({
      isLoading,
      providerMissing,
      tableInstance,
    }),
    [isLoading, providerMissing, tableInstance],
  );

  return tableDataValues;
};

export * from './cells';
export * from './columns';
export * from './context';
