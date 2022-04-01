import { HeaderGroup } from 'react-table';

const TableHeaderRow = ({ headerGroup, ...props }: { headerGroup: HeaderGroup<{}> }) => {
  return (
    <tr {...props}>
      {headerGroup.headers.map((column) => {
        const { key: headerKey, ...restColumn } = column.getHeaderProps();

        return (
          <th key={headerKey} {...restColumn}>
            {column.render('Header')}
          </th>
        );
      })}
    </tr>
  );
};

export default TableHeaderRow;
