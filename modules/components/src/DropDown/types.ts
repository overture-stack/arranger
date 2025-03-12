import type { ThemedButtonProps } from '#Button/types.js';
import type { InputThemeProps } from '#Input/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface DropDownThemeProps extends ThemedButtonProps {
	arrowColor: string;
	arrowTransition: string;

	// Child components
	ListWrapper: ThemeCommon.NonButtonThemeProps &
		ThemeCommon.BoxModelHoverProperties &
		ThemeCommon.FontHoverProperties & {
			maxHeight: string;
			width: string;
		};
	SelectionControls: ThemedButtonProps;
	TextFilter: InputThemeProps;
}

export interface DropDownProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<DropDownThemeProps>;
}

export interface DropDownMenuProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<DropDownThemeProps>;
}
