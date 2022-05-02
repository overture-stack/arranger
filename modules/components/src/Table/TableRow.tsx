import { Row } from '@tanstack/react-table';

const TableRow = ({
  row,
  ...props
}: {
  row: Row<Record<string, any>>;
}) => {
  return (
    <tr {...props}>
      {row.getVisibleCells().map((cell) => {
        const { key: cellKey, ...restCellProps } = cell.getCellProps();

        return (
          <td key={cellKey} {...restCellProps}>
            {cell.renderCell()}
          </td>
        );
      })}
    </tr>
  );
};

export default TableRow;
