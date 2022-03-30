import { ThemeCommon } from '@/ThemeContext/types';

export interface TextHighlightThemeProps
  extends ThemeCommon.BoxModelProperties,
    ThemeCommon.CustomCSS,
    ThemeCommon.FontProperties {
  wrapperClassName?: string;
  wrapperCSS?: ThemeCommon.cssInterpolation;
}
