import { MouseEvent, PropsWithChildren } from 'react';

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

export interface MouseEventProps<T = HTMLButtonElement> {
  onClick?: (event: MouseEvent<T>) => unknown;
}

// To be used in components.
type ButtonProps<T = HTMLButtonElement> = PropsWithChildren<
  Partial<ThemedButtonProps> & MouseEventProps<T>
>;
export default ButtonProps;
