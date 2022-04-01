import { css } from '@emotion/react';
import { useTable } from 'react-table';

import RewriteWarning from './RewriteWarning';
import TableHeaderRow from './TableHeaderRow';
import TableRow from './TableRow';
import { Props } from './types';

const columns = [{ id: 'ID', header: 'HEADER' }]; // mock

const Table = ({ hideWarning = false }: Props) => {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns,
    data: [{}],
  });

  return hideWarning ? (
    <table
      css={css`
        width: 100%;
      `}
      {...getTableProps()}
    >
      <thead>
        {headerGroups.map((headerGroup) => {
          const { key: headerGroupKey, ...headerGroupProps } = headerGroup.getHeaderGroupProps();

          return (
            <TableHeaderRow headerGroup={headerGroup} key={headerGroupKey} {...headerGroupProps} />
          );
        })}
      </thead>

      <tbody {...getTableBodyProps}>
        {rows.map((row) => {
          prepareRow(row);
          const { key: rowKey, ...rowProps } = row.getRowProps();

          return <TableRow key={rowKey} row={row} {...rowProps} />;
        })}
      </tbody>
    </table>
  ) : (
    <RewriteWarning />
  );
};

export default Table;
