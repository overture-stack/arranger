import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import ButtonProps from './types';

const Button = styled('button', {
  shouldForwardProp: isPropValid,
})<ButtonProps>`
  align-items: center;
  background: ${({ background }) => background};
  box-sizing: border-box;
  border-color: ${({ borderColor }) => borderColor};
  border-radius: ${({ borderRadius }) => borderRadius};
  color: ${({ fontColor }) => fontColor};
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};
  display: flex;
  flex: ${({ flex }) => flex};
  font-family: ${({ fontFamily }) => fontFamily};
  font-size: ${({ fontSize }) => fontSize};
  font-weight: ${({ fontWeight }) => fontWeight};
  justify-content: center;
  letter-spacing: ${({ letterSpacing }) => letterSpacing};
  line-height: ${({ lineHeight }) => lineHeight};
  margin: ${({ margin }) => margin};
  padding: ${({ padding }) => padding};
  pointer-events: ${({ hidden }) => hidden && 'none'};
  text-transform: ${({ textTransform }) => textTransform};
  visibility: ${({ hidden }) => hidden && 'hidden'};

  &:hover {
    background: ${({ hoverBackground }) => hoverBackground};
  }

  &.disabled,
  &:disabled {
    background: ${({ disabledBackground }) => disabledBackground};
    color: ${({ disabledFontColor }) => disabledFontColor};
    cursor: not-allowed;
  }
`;

export const TransparentButton = styled(Button)<ButtonProps>`
  background: ${({ background = 'none' }) => background};
  border: ${({ borderColor }) => (borderColor ? `0.1rem solid ${borderColor}` : 'none')};
  color: ${({ fontColor = 'inherit' }) => fontColor};
  font-family: ${({ fontFamily = 'inherit' }) => fontFamily};
  justify-content: flex-start;
  margin: ${({ margin = 0 }) => margin};
  padding: ${({ padding = 0 }) => padding};
  text-align: left;
`;

export default Button;
