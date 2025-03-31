import type { ElementType } from 'react';

import type { CountDisplayThemeProps } from '#Table/CountDisplay/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export type ToolbarThemeProps = {
	spacing: string;
	tools: ElementType[];
	CountDisplay: CountDisplayThemeProps;
} & ThemeCommon.FontProperties &
	ThemeCommon.CustomCSS;

export type ToolbarProps = {
	theme?: RecursivePartial<ToolbarThemeProps>;
} & ThemeCommon.CustomCSS;
