import { FC, HTMLProps } from 'react';
import { SerializedStyles } from '@emotion/react';

export interface Option {
  disabled?: boolean;
  title?: FC<{ toggleStatus?: string } | undefined>;
  value: string;
}

export interface ToggleButtonThemeProps {
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
  OptionCSS: SerializedStyles;
}

export default interface Props extends Omit<HTMLProps<HTMLButtonElement>, 'onChange'> {
  onChange?: ({ value }: { value: string }) => any;
  options: Option[];
  theme?: ToggleButtonThemeProps;
  value: string;
}
