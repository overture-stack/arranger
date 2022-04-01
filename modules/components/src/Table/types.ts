import { ThemeCommon } from '@/ThemeContext/types';

export interface TableThemeProps
  extends ThemeCommon.BoxModelProperties,
    ThemeCommon.CustomCSS,
    ThemeCommon.FontProperties {
  wrapperClassName?: string;
  wrapperCSS?: ThemeCommon.cssInterpolation;
}

export interface Props extends TableThemeProps {
  hideWarning?: boolean;
}
