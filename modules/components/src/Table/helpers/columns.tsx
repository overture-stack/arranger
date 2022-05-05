import { ColumnDef, Table, TableGenerics } from '@tanstack/react-table';
import { get } from 'lodash';

import { ColumnMappingInterface } from '@/DataContext/types';
import { ColumnsDictionary, TableCellTypes, TableHeaderTypes } from '@/Table/types';
import { emptyObj } from '@/utils/noops';

import { defaultCellTypes, getCellValue } from './cells';

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
  customCells = emptyObj,
  customHeaders = emptyObj,
  table,
  visibleColumns = [],
}: {
  customCells?: Partial<TableCellTypes>;
  customHeaders?: Partial<TableHeaderTypes>;
  table: Table<any>;
  visibleColumns: ColumnMappingInterface[];
}) => {
  const cellTypes = {
    ...defaultCellTypes,
    ...customCells,
  } as TableCellTypes;

  const headerTypes = {
    // ...defaultHeaderTypes,
    ...customHeaders,
  } as TableHeaderTypes;

  return visibleColumns.map((visibleColumn) =>
    table.createDataColumn(visibleColumn?.accessor, {
      ...visibleColumn,
      cell: ({ row }) => {
        const valueFromRow = getCellValue(row?.original, visibleColumn);
        const cellType =
          cellTypes[visibleColumn?.accessor] || cellTypes[visibleColumn?.type] || cellTypes.all;

        if (cellType) {
          return typeof cellType === 'function'
            ? cellType({
                ...visibleColumn,
                ...row,
                value: valueFromRow,
              })
            : cellType;
        }

        return valueFromRow;
      },
      header: ({ header }) => {
        const label = visibleColumn?.displayName || header.id;
        const headerType =
          headerTypes[visibleColumn?.accessor] ||
          headerTypes[visibleColumn?.type] ||
          headerTypes.all;

        if (headerType) {
          return typeof headerType === 'function'
            ? headerType({
                ...visibleColumn,
                ...header,
              })
            : headerType;
        }

        return label;
      },
    }),
  );
};
