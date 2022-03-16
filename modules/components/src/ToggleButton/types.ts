import { SerializedStyles } from '@emotion/react';

export interface Option {
  disabled?: boolean;
  title?: string;
  value: string;
}

export default interface Props {
  onChange?: ({ value }: { value: string }) => any;
  options: Option[];
  value: string;
}

export interface ToggleButtonThemeProps {
  ToggleButton: {
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
  };
}
