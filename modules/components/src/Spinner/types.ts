import { ElementType, ReactNode } from 'react';

import { ThemeCommon } from '@/ThemeContext/types';

export interface SpinnerThemeProps extends ThemeCommon.CustomCSS {
  color: string;
  inverted: boolean;
  size: string | number;
  Spinner: ElementType;
  vertical: boolean;
}

export interface SpinnerProps extends ThemeCommon.CustomCSS {
  children?: ReactNode;
  theme?: Partial<SpinnerThemeProps>;
}
