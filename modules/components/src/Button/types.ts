import { MouseEventHandler, PropsWithChildren, TouchEventHandler } from 'react';

import { ThemeCommon } from '@/ThemeContext/types';
import { TooltipThemeProperties } from '@/Tooltip/types';
import { RecursivePartial } from '@/utils/types';

export type ButtonCustomProps = ThemeCommon.MouseEventProperties & ThemeCommon.CustomCSS;

export type ButtonThemeProps = ThemeCommon.BoxModelProperties &
	ThemeCommon.BoxModelActiveProperties &
	ThemeCommon.BoxModelDisabledProperties &
	ThemeCommon.BoxModelHoverProperties &
	ThemeCommon.CustomCSS &
	ThemeCommon.FontProperties &
	ThemeCommon.FontActiveProperties &
	ThemeCommon.FontDisabledProperties &
	ThemeCommon.FontHoverProperties &
	TooltipThemeProperties;

export interface MouseEventProps {
	onClick: MouseEventHandler;
	onMouseDown: MouseEventHandler;
	onTouchStart: TouchEventHandler;
}

// To be used in the theme interface.
export type ThemedButtonProps = ButtonCustomProps & ButtonThemeProps;

// To be used in components.
type ButtonProps = PropsWithChildren<
	Partial<MouseEventProps> &
		Partial<ButtonCustomProps> & {
			theme?: RecursivePartial<ButtonThemeProps>;
		}
>;
export default ButtonProps;
