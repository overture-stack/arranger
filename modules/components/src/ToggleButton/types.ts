import { FC, HTMLProps } from 'react';
import { SerializedStyles } from '@emotion/react';

import { ThemedButtonProps } from '@/Button/types';

export interface Option {
  disabled?: boolean;
  title?: FC<{ toggleStatus?: string } | undefined>;
  value: string;
}

export interface ToggleButtonThemeProps extends ThemedButtonProps {
  OptionCSS: SerializedStyles;
}

export default interface Props extends Omit<HTMLProps<HTMLButtonElement>, 'onChange'> {
  onChange?: ({ value }: { value: string }) => any;
  options: Option[];
  theme?: ToggleButtonThemeProps;
  value: string;
}
