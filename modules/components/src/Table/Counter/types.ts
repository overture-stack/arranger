import { SpinnerThemeProps } from '@/Spinner/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface CounterThemeProps extends ThemeCommon.FontProperties {
  hideLoader: boolean;

  // Child components
  Spinner: Partial<SpinnerThemeProps>;
}

export interface CounterProps extends ThemeCommon.CustomCSS {
  theme?: Partial<CounterThemeProps>;
}
