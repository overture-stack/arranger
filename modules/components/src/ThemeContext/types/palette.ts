import baseTheme from '@/ThemeContext/baseTheme';
import { RecursivePartial } from '@/utils/types';

export type ColorNames = keyof typeof baseTheme.colors;

export interface Common {
	black: string;
	white: string;
}
export interface Hues {
	50: string;
	100: string;
	200: string;
	300: string;
	400: string;
	500: string;
	600: string;
	700: string;
	800: string;
	900: string;
	A100: string;
	A200: string;
	A400: string;
	A700: string;
}

export type GenericColors = Record<string, any>;

export type Colors = Record<ColorNames, Hues> & Record<'common', Common>;
export type ColorsOptions = RecursivePartial<Colors>;

export type Mode = 'light' | 'dark';

export type Palette = typeof baseTheme.palette;
