import { ThemedButtonProps } from '@/Button/types';
import { DropDownThemeProps } from '@/DropDown/types';
import { InputThemeProps } from '@/Input/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

export interface ColumnSelectButtonThemeProps extends ThemedButtonProps, DropDownThemeProps {
	enableFilter: boolean;
	filterPlaceholder: string;
	label: ThemeCommon.ChildrenType;
	TextFilter: InputThemeProps;
}

export interface ColumnSelectButtonProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<ColumnSelectButtonThemeProps>;
}
