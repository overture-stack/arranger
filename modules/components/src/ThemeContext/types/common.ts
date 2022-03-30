import { Interpolation } from '@emotion/react';

import { PrefixKeys } from '@/utils/types';

import { ThemeOptions } from '.';

export type cssInterpolation = Interpolation<ThemeOptions>;

export interface BoxModelProperties {
  background?: string;
  borderColor?: string;
  borderRadius?: string;
  flex?: string;
  margin?: string;
  overflow?: string;
  padding?: string;
  position?: string;
}

export type BoxModelActiveProperties = PrefixKeys<BoxModelProperties, 'active'>;
export type BoxModelDisabledProperties = PrefixKeys<BoxModelProperties, 'disabled'>;

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
  textDecoration?: string;
  textTransform?: string;
}

export type FontActiveProperties = PrefixKeys<FontProperties, 'active'>;
export type FontDisabledProperties = PrefixKeys<FontProperties, 'disabled'>;

export interface MouseEventProperties extends Partial<PrefixKeys<BoxModelProperties, 'hover'>> {
  cursor?: string;
  disabled?: boolean;
  title?: string;
}

export type MouseEventActiveProperties = PrefixKeys<MouseEvent, 'active'>;
export type MouseEventDisabledProperties = PrefixKeys<MouseEvent, 'disabled'>;

export type NonButtomThemeProps = BoxModelProperties & CustomCSS & FontProperties;
