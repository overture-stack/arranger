import { ThemeCommon } from '@/ThemeContext/types';

export interface TextHighlightThemeProps extends ThemeCommon.NonButtonThemeProps {
  wrapperClassName?: string;
  wrapperCSS?: ThemeCommon.cssInterpolation;
}
