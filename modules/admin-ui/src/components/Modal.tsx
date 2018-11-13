import * as React from 'react';
import { Portal } from 'react-portal';
import styled from 'react-emotion';

export const Overlay = styled('div')`
  position: absolute;
  left: 0px;
  right: 0px;
  top: 0px;
  bottom: 0px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1;
`;

export const ModalOverlay: React.ComponentType<
  React.HtmlHTMLAttributes<HTMLDivElement>
> = ({ children, ...props }) => {
  return (
    <Portal>
      <Overlay {...props}>{children}</Overlay>
    </Portal>
  );
};
