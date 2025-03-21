import type { MouseEventHandler, PropsWithChildren, TouchEventHandler } from 'react';

import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { TooltipThemeProperties } from '#Tooltip/types.js';
import type { RecursivePartial } from '#utils/types.js';

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
export type ButtonProps = PropsWithChildren<
	Partial<MouseEventProps> &
		Partial<ButtonCustomProps> & {
			theme?: RecursivePartial<ButtonThemeProps>;
		}
>;
