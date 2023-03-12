import { ReactNode } from 'react';
import { Interpolation } from '@emotion/react';
import { EmotionJSX } from '@emotion/react/types/jsx-namespace';

import { PrefixKeys } from '@/utils/types';

import { ThemeOptions } from '.';

// hacky, but Emotion typing is finicky
export type ChildrenType = () => EmotionJSX.Element | ReactNode;
export type cssInterpolation = Interpolation<ThemeOptions>;

export interface BoxModelProperties {
	background?: string;
	borderColor?: string;
	borderRadius?: string;
	flex?: string;
	height?: string;
	margin?: string | 0;
	overflow?: string;
	padding?: string | 0;
	position?: string;
	width?: string;
}

export type BoxModelActiveProperties = PrefixKeys<BoxModelProperties, 'active'>;
export type BoxModelDisabledProperties = PrefixKeys<BoxModelProperties, 'disabled'>;
export type BoxModelHoverProperties = PrefixKeys<BoxModelProperties, 'hover'>;

export interface CustomCSS {
	className?: string;
	css?: cssInterpolation;
	key?: string;
}

export interface FontProperties {
	fontColor?: string;
	fontFamily?: string;
	fontSize?: string;
	fontWeight?: number | string;
	letterSpacing?: string;
	lineHeight?: string;
	textOverflow?: string;
	textDecoration?: string;
	textTransform?: string;
	whiteSpace?: string;
}

export type FontActiveProperties = PrefixKeys<FontProperties, 'active'>;
export type FontDisabledProperties = PrefixKeys<FontProperties, 'disabled'>;
export type FontHoverProperties = PrefixKeys<FontProperties, 'hover'>;

export interface MouseEventProperties extends Partial<PrefixKeys<BoxModelProperties, 'hover'>> {
	cursor?: string;
	disabled?: boolean;
	title?: string;
}

export type MouseEventActiveProperties = PrefixKeys<MouseEvent, 'active'>;
export type MouseEventDisabledProperties = PrefixKeys<MouseEvent, 'disabled'>;
export type MouseEventHoverProperties = PrefixKeys<MouseEvent, 'hover'>;

export type NonButtonThemeProps = BoxModelProperties & CustomCSS & FontProperties;
