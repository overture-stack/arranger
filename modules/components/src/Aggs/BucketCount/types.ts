import { HTMLProps } from 'react';

import { ThemeCommon } from '@/ThemeContext/types';
import { cssInterpolation } from '@/ThemeContext/types/common';

export type BucketCountThemeProps = ThemeCommon.CustomCSS &
  ThemeCommon.BoxModelActiveProperties &
  ThemeCommon.BoxModelDisabledProperties &
  ThemeCommon.BoxModelProperties &
  ThemeCommon.FontActiveProperties &
  ThemeCommon.FontDisabledProperties &
  ThemeCommon.FontProperties;

export default interface Props extends HTMLProps<HTMLButtonElement> {
  css?: cssInterpolation;
  theme?: Partial<BucketCountThemeProps>;
}
