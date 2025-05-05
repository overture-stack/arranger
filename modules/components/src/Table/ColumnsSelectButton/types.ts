import type { ReactNode } from 'react';

import type { ThemedButtonProps } from '#Button/types.js';
import type { DropDownThemeProps } from '#DropDown/types.js';
import type { InputThemeProps } from '#Input/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface ColumnSelectButtonThemeProps extends ThemedButtonProps, DropDownThemeProps {
	enableFilter: boolean;
	filterPlaceholder: string;
	label: ReactNode;
	TextFilter: InputThemeProps;
}

export interface ColumnSelectButtonProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<ColumnSelectButtonThemeProps>;
}
