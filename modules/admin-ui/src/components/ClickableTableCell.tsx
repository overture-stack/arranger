import * as React from 'react';
import Link from 'mineral-ui/Link';
import styled from 'react-emotion';
// import { createStyledComponent } from 'mineral-ui';
import { TableCell } from 'mineral-ui/Table';

const StyledLink = styled(Link)`
  cursor: pointer;
`;

export interface TableCellRenderProp {
  props: {
    children: React.ReactNode;
    columnKey: string;
    content: string;
    density: string;
    element: string;
    highContrast: boolean;
    rowIndex: number;
    striped: boolean;
  };
  state: {};
}

export default ({
  onClick = () => {},
  props,
}: {
  props: TableCellRenderProp;
  onClick: (cellProps: TableCellRenderProp) => any;
}) => {
  const onLinkClick = () => onClick(props);
  return (
    <TableCell>
      <StyledLink onClick={onLinkClick}>{props.props.children}</StyledLink>
    </TableCell>
  );
};
