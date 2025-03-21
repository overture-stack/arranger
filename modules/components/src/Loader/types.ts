import type { ElementType, PropsWithChildren } from 'react';

import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface LoaderThemeProps extends ThemeCommon.CustomCSS {
	color: string;
	Component: ElementType;
	inverted: boolean;
	size: string | number;
	vertical: boolean;
}

export interface LoaderProps extends PropsWithChildren, ThemeCommon.CustomCSS {
	theme?: RecursivePartial<LoaderThemeProps>;
}

export interface LoaderContainerThemeProps extends ThemeCommon.NonButtonThemeProps, LoaderThemeProps {
	disabled?: boolean;
}

export interface LoaderContainerProps extends PropsWithChildren, ThemeCommon.CustomCSS {
	disabled?: boolean;
	isLoading?: boolean;
	theme?: RecursivePartial<Omit<LoaderContainerThemeProps, 'disabled'>>;
}

export interface LoaderOverlayThemeProps extends ThemeCommon.NonButtonThemeProps, LoaderThemeProps {}

export interface LoaderOverlayProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<LoaderOverlayThemeProps>;
}
