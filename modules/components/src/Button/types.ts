import { PropsWithChildren } from 'react';

import { ThemeCommon } from '@/ThemeContext/types';

// To be used in the theme interface.
export type ThemedButtonProps = ThemeCommon.MouseEventProperties &
  ThemeCommon.BoxModelProperties &
  ThemeCommon.BoxModelActiveProperties &
  ThemeCommon.BoxModelDisabledProperties &
  ThemeCommon.CustomCSS &
  ThemeCommon.FontProperties &
  ThemeCommon.FontActiveProperties &
  ThemeCommon.FontDisabledProperties;

// To be used in components.
type ButtonProps = PropsWithChildren<Partial<ThemedButtonProps>>;
export default ButtonProps;
