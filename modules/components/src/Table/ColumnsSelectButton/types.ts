import { DropDownThemeProps } from '@/DropDown/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface ColumnSelectButtonThemeProps extends DropDownThemeProps {
	enableFilter: boolean;
	filterPlaceholder: string;
	label: ThemeCommon.ChildrenType;
}

export interface ColumnSelectButtonProps extends ThemeCommon.CustomCSS {
	theme?: Partial<ColumnSelectButtonThemeProps>;
}
