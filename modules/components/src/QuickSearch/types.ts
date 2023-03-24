import { FC } from 'react';

import { ThemedButtonProps } from '@/Button/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { ToggleButtonThemeProps } from '@/ToggleButton/types';
import { GenericFn } from '@/utils/noops';

interface QuickSearchWrapperProps extends ThemeCommon.CustomCSS {
	collapsedBackground: string;
	collapsible: boolean;
	groupDividerColor: string;
	headerBackground: string;
	headerDividerColor: string;
	headerFontColor: string;
	headerSticky: boolean;
	headerTitle: string;
}

interface IconButtonProps extends ThemeCommon.CustomCSS {
	fill: string;
	Icon: FC;
	onClick: GenericFn;
	size: number | string;
	transition: string;
}

interface DropDownResultsProps extends ThemeCommon.CustomCSS {
	DropdownItemComponent: FC;
	logoEntityEnabled: boolean;
	logoEntityColor1: string;
	logoEntityColor2: string;
	logoEntityColor3: string;
	logoEntityColor4: string;
	logoEntityColor5: string;
}

interface PinnedValuesProps extends ThemeCommon.CustomCSS {
	enabled: boolean;
	PinnedValueComponent: FC;
}

interface FilterInputProps extends ThemeCommon.CustomCSS {
	Icon: FC;
	InputComponent: FC;
	LoadingIcon: FC;
	placeholder: string;
}

interface QuickSearchQueryProps {
	searchLowercase: boolean;
	searchTextDelimiters: string[];
}

export interface QuickSearchThemeProps {
	ActionIcon?: IconButtonProps;
	DropDownItems?: DropDownResultsProps;
	FilterInput?: FilterInputProps;
	MoreOrLessButton?: ThemedButtonProps;
	PinnedValues?: PinnedValuesProps;
	quickSearchQuery?: QuickSearchQueryProps;
	QuickSearchWrapper?: QuickSearchWrapperProps;
	ToggleButton?: ToggleButtonThemeProps;
	TreeJointIcon?: IconButtonProps;
}

export interface QuickSearchProps {
	theme?: Partial<QuickSearchThemeProps>;
}
