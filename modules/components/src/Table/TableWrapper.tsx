import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import { TableThemeProps } from './types';

const TableWrapper = styled('section', {
  shouldForwardProp: isPropValid,
})<TableThemeProps['TableWrapper']>`
  background: ${({ background }) => background};
  border: ${({ borderColor }) => borderColor && `1px solid ${borderColor}`};
  border-radius: ${({ borderRadius }) => borderRadius};
  display: flex;
  flex: ${({ flex }) => flex};
  margin: ${({ margin }) => margin};
  overflow: ${({ overflow = 'auto' }) => overflow};
  padding: ${({ padding }) => padding};
  position: ${({ position = 'relative' }) => position};
`;

export default TableWrapper;
