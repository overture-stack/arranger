import { CounterThemeProps } from '@/Table/Counter/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface TableToolbarThemeProps extends ThemeCommon.FontProperties {
  TableCounter: CounterThemeProps;
}

export interface TableToolbarProps extends ThemeCommon.CustomCSS {
  theme?: Partial<TableToolbarThemeProps>;
}
