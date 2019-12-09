import { TableRow } from 'mineral-ui/Table';
import styled from '@emotion/styled';
import { ComponentType } from 'react';

const SelectableTableRow = styled(TableRow)`
  background: ${({
    selected = false,
    theme,
  }: {
    selected: boolean;
    theme: any;
  }) => (selected ? theme.color_theme_30 : 'auto')};
`;

export default SelectableTableRow;
