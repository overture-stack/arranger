import { MouseEvent, PropsWithChildren } from 'react';

import { ThemeCommon } from '@/ThemeContext/types';
import { TooltipThemeProperties } from '@/Tooltip';

export type ButtonCustomProps = ThemeCommon.MouseEventProperties & ThemeCommon.CustomCSS;

export type ButtonStyleProps = ThemeCommon.BoxModelProperties &
	ThemeCommon.BoxModelActiveProperties &
	ThemeCommon.BoxModelDisabledProperties &
	ThemeCommon.BoxModelHoverProperties &
	ThemeCommon.FontProperties &
	ThemeCommon.FontActiveProperties &
	ThemeCommon.FontDisabledProperties &
	ThemeCommon.FontHoverProperties &
	TooltipThemeProperties;

export interface MouseEventProps<T = HTMLButtonElement> {
	onClick?: (event: MouseEvent<T>) => unknown;
}

// To be used in the theme interface.
export type ThemedButtonProps = ButtonCustomProps & ButtonStyleProps;

// To be used in components.
type ButtonProps<T = HTMLButtonElement> = PropsWithChildren<
	MouseEventProps<T> &
		ButtonCustomProps & {
			theme?: Partial<ButtonStyleProps>;
		}
>;
export default ButtonProps;
