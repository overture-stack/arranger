import { HTMLProps } from 'react';
import { SerializedStyles } from '@emotion/react';

export interface BucketCountThemeProps {
  activeBackground: string;
  activeBorderColor: string;
  activeFontColor: string;
  activeFontSize: string;
  background: string;
  borderColor: string;
  borderRadius: string;
  className: string;
  css: SerializedStyles;
  disabledBackground: string;
  disabledBorderColor: string;
  disabledFontColor: string;
  disabledFontSize: string;
  fontColor: string;
  fontSize: string;
}

export default interface Props extends HTMLProps<HTMLButtonElement> {
  css?: SerializedStyles;
  theme?: BucketCountThemeProps;
}
