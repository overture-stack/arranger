import { SerializedStyles } from '@emotion/react';

export default interface Props {
  className?: string;
  css?: SerializedStyles;
  fill?: string;
  isTreeJoint?: boolean;
  pointUp?: boolean;
  size?: string | number;
  transition?: string;
}

export interface ArrowIconThemeProps {
  ArrowIcon: {
    className: string;
    css: SerializedStyles;
    fill: string;
    size: string | number;
    transition: string;
  };
}
