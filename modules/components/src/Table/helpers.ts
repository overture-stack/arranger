import { useEffect, useMemo, useState } from 'react';
import {
  createTable,
  useTableInstance,
  Table,
  ColumnDef,
  getCoreRowModelSync,
} from '@tanstack/react-table';
import { get } from 'lodash';

import { ColumnMappingInterface } from '@/DataContext/types';

import { useTableContext } from './TableContext';
import { ColumnsDictionary } from './types';

export const aggregateCustomColumns = (
  customColumns: ColumnMappingInterface[] = [],
  serverColumns: ColumnMappingInterface[] = [],
) => {
  const existingColumns = serverColumns.map((serverColumn) => {
    const customColumn = customColumns.find((column) => column.field === serverColumn.field) || {};

    return {
      ...serverColumn,
      ...customColumn,
    };
  });

  const existingColumnFields = existingColumns
    .map((column) => column.field)
    .filter((field) => !!field);

  return existingColumns.concat(
    customColumns.filter((column) => !existingColumnFields.includes(column.field)),
  );
};

export const columnsArrayToDictionary = (columns: ColumnMappingInterface[] = []) =>
  columns.reduce(
    (dict, column) => ({
      ...dict,
      [column.field]: column,
    }),
    {} as ColumnsDictionary,
  );

export const getVisibleColumns = (columns: ColumnMappingInterface[] = []) =>
  columnsArrayToDictionary(columns.filter((column) => column.show));

export const makeTableColumns = ({
  table,
  visibleColumns = [],
}: {
  table: Table<any>;
  visibleColumns: ColumnMappingInterface[];
}) => {
  return table.createColumns(
    visibleColumns.map(({ accessor = '', ...column }: ColumnMappingInterface) =>
      table.createDataColumn(accessor, {
        ...column,
        cell: ({ row }) => get(row?.original, accessor.split('.'), ''),
      }),
    ),
  );
};

const table = createTable();

export const useTableData = () => {
  const { isLoading, providerMissing, tableData, visibleColumnsDict } = useTableContext({
    callerName: 'Table - useTableData',
  });
  const [tableColumns, setTableColumns] = useState<ColumnDef<any>[]>([]);

  useEffect(() => {
    const visibleColumns = Object.values(visibleColumnsDict);
    visibleColumns.length > 0 && setTableColumns(makeTableColumns({ table, visibleColumns }));
  }, [visibleColumnsDict]);

  const tableInstance = useTableInstance(table, {
    columns: tableColumns,
    data: tableData,
    getCoreRowModel: getCoreRowModelSync(),
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
