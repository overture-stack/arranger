import { css } from '@emotion/react';

import { useTableData } from './helpers';
import RewriteWarning from './RewriteWarning';
import TableHeaderRow from './TableHeaderRow';
import TableRow from './TableRow';
import TableWrapper from './TableWrapper';
import { TableProps } from './types';

const Table = ({ hideWarning = false }: TableProps) => {
  const { isLoading, providerMissing, tableInstance } = useTableData();


  return hideWarning ? (
    <TableWrapper
    >
      {providerMissing ? (
        <div>The table is missing one of its Context providers.</div>
      ) : (
        <table
          {...tableInstance.getTableProps()}
        >
          <thead
          >
            {tableInstance.getHeaderGroups().map((headerGroup) => {
              const { key: headerGroupKey, ...headerGroupProps } =
                headerGroup.getHeaderGroupProps();

              return (
                <TableHeaderRow
                  headerGroup={headerGroup}
                  key={headerGroupKey}
                  {...headerGroupProps}
                />
              );
            })}
          </thead>

          <tbody {...tableInstance.getTableBodyProps}>
            {tableInstance.getRowModel().rows.map((row) => {
              const { key: rowKey, ...rowProps } = row.getRowProps();

              return (
                <TableRow
                  key={rowKey}
                  row={row}
                  {...rowProps}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </TableWrapper>
  ) : (
    <RewriteWarning />
  );
};

export default Table;
