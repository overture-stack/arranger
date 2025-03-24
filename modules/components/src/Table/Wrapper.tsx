import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import type { TableThemeProps } from './types.js';

const TableWrapper = styled('section', {
	shouldForwardProp: isPropValid,
})<TableThemeProps['TableWrapper']>`
	background: ${({ background }) => background};
	border: ${({ borderColor }) => borderColor && `1px solid ${borderColor}`};
	border-radius: ${({ borderRadius }) => borderRadius};
	display: flex;
	flex: ${({ flex }) => flex};
	flex-wrap: wrap;
	margin: ${({ margin }) => margin};
	overflow: ${({ overflow = 'auto' }) => overflow};
	padding: ${({ padding }) => padding};
	position: ${({ position = 'relative' }) => position};
	width: ${({ width = '100%' }) => width};
`;

export default TableWrapper;
