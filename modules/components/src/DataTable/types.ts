import { ThemeCommon } from '@/ThemeContext/types';

export interface DataTableThemeProps {
  DropDown: {
    arrowColor: string;
    arrowTransition: string;
  } & ThemeCommon.CustomCSS;
}
