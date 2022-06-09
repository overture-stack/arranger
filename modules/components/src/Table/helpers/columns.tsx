import { HTMLAttributes, useEffect, useRef } from 'react';
import { Table } from '@tanstack/react-table';
import { mergeWith } from 'lodash';

import { ColumnMappingInterface } from '@/DataContext/types';
import { ColumnsDictionary, ColumnTypesObject, TableCellProps } from '@/Table/types';
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

export const getColumnsByAttribute = (
  columns: ColumnMappingInterface[] = [],
  attribute: keyof ColumnMappingInterface,
) => columns.filter((column) => column[attribute]);

function IndeterminateCheckbox({
  indeterminate,
  className = '',
  ...rest
}: { indeterminate?: boolean } & HTMLAttributes<HTMLInputElement>) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ref = useRef<HTMLInputElement>(null!);

  useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      ref.current.indeterminate = indeterminate;
    }
  }, [ref, indeterminate]);

  return <input type="checkbox" ref={ref} className={className + ' cursor-pointer'} {...rest} />;
}

export const makeTableColumns = ({
  allowRowSelection,
  columnTypes: customColumnTypes = emptyObj,
  table,
  total,
  visibleColumns = [],
}: {
  allowRowSelection?: boolean;
  columnTypes?: Partial<ColumnTypesObject>;
  table: Table<any>;
  total: number;
  visibleColumns: ColumnMappingInterface[];
}) => {
  const hasData = total > 0;
  const columnTypes = mergeWith(customColumnTypes, defaultCellTypes, (objValue, srcValue) => ({
    ...objValue,
    cellValue: objValue?.cellValue || srcValue,
  })) as ColumnTypesObject;

  const tableColumns = visibleColumns.map((visibleColumn) => {
    const columnType = mergeWith(
      {},
      columnTypes.all,
      columnTypes[visibleColumn?.isArray ? 'list' : visibleColumn?.type],
      columnTypes[visibleColumn?.accessor],
    );

    return table.createDataColumn((row) => getCellValue(row, visibleColumn), {
      ...visibleColumn,
      cell: ({ getValue, cell }) => {
        const cellType = columnType?.cellValue;
        const valueFromRow = getValue();

        if (cellType) {
          return typeof cellType === 'function'
            ? cellType({
                ...cell,
                column: {
                  ...visibleColumn,
                  ...cell.column,
                },
                value: valueFromRow,
              } as TableCellProps)
            : cellType;
        }

        return valueFromRow;
      },
      header: ({ header }) => {
        const label = visibleColumn?.displayName || header.id;
        const headerType = columnType?.headerValue;

        if (headerType) {
          return typeof headerType === 'function'
            ? headerType({
                ...visibleColumn,
                ...header,
                disabled: !hasData,
              })
            : headerType;
        }

        return label;
      },
      id: visibleColumn?.id || visibleColumn?.accessor,
    });
  });

  return allowRowSelection
    ? [
        table.createDisplayColumn({
          id: 'select',
          header: ({ instance }) => (
            <IndeterminateCheckbox
              {...{
                checked: instance.getIsAllRowsSelected(),
                disabled: !hasData,
                indeterminate: instance.getIsSomeRowsSelected(),
                onChange: instance.getToggleAllRowsSelectedHandler(),
              }}
            />
          ),
          cell: ({ row }) => (
            <div className="px-1">
              <IndeterminateCheckbox
                {...{
                  checked: row.getIsSelected(),
                  indeterminate: row.getIsSomeSelected(),
                  onChange: row.getToggleSelectedHandler(),
                }}
              />
            </div>
          ),
        }),
      ].concat(tableColumns)
    : tableColumns;
};
