import styled from '@emotion/styled';

const Button = styled.button`
  align-items: center;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  justify-content: center;
  pointer-events: ${({ hidden }) => (hidden ? 'none' : undefined)};
  visibility: ${({ hidden }) => (hidden ? 'hidden' : undefined)};

  &.disabled,
  &:disabled {
    cursor: not-allowed;
  }
`;

export const TransparentButton = styled(Button)`
  background: none;
  border: none;
  justify-content: flex-start;
  margin: 0;
  padding: 0;
  text-align: left;
`;

export default Button;
