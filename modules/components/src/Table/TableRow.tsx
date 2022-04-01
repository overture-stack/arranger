import { Row } from 'react-table';

const TableRow = ({ row, ...props }: { row: Row<{}> }) => {
  return (
    <tr {...props}>
      {row.cells.map((cell) => {
        const { key: cellKey, ...restCellProps } = cell.getCellProps();

        return (
          <td key={cellKey} {...restCellProps}>
            {cell.render('Cell')}
          </td>
        );
      })}
    </tr>
  );
};

export default TableRow;
