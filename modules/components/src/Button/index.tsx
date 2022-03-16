import styled from '@emotion/styled';

export const TransparentButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  justify-content: flex-start;
  margin: 0;
  padding: 0;
  pointer-events: ${({ hidden }) => (hidden ? 'none' : undefined)};
  text-align: left;
  visibility: ${({ hidden }) => (hidden ? 'hidden' : undefined)};
`;
