import { HeaderGroup } from '@tanstack/react-table';

const TableHeaderRow = ({
  headerGroup,
  ...props
}: {
  headerGroup: HeaderGroup<any>;
}) => {

  return (
    <tr {...props}>
      {headerGroup.headers.map((header) => {
        const { key: headerKey, ...restHeader } = header.getHeaderProps();

        return (
          <th
            key={headerKey}
            {...restHeader}
          >
            {header.isPlaceholder ? null : header.renderHeader()}
          </th>
        );
      })}
    </tr>
  );
};

export default TableHeaderRow;
