import { ThemedButtonProps } from '@/Button/types';
import { DropDownThemeProps } from '@/DropDown/types';
import { InputThemeProps } from '@/Input/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface ColumnSelectButtonThemeProps extends ThemedButtonProps, DropDownThemeProps {
	enableFilter: boolean;
	filterPlaceholder: string;
	label: ThemeCommon.ChildrenType;
	TextFilter: InputThemeProps;
}

export interface ColumnSelectButtonProps extends ThemeCommon.CustomCSS {
	theme?: Partial<ColumnSelectButtonThemeProps>;
}
