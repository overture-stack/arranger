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
	evenRowColor: string;
	entityLogo: {
		borderRadius: string;
		color1: string;
		color2: string;
		color3: string;
		color4: string;
		color5: string;
		enabled: boolean;
		margin: string;
		width: string;
	} & ThemeCommon.CustomCSS;
	lineHeight: string;
	resultKeyText: {
		fontSize: string;
	} & ThemeCommon.CustomCSS;
	resultValue: {
		fontSize: string;
	} & ThemeCommon.CustomCSS;
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

interface FilterQueryField {
	entityName?: string;
	fieldName: string;
	gqlField: string;
	jsonPath: string;
	query: string;
}

interface QuickSearchQueryProps {
	searchLowercase?: boolean;
	searchTextDelimiters?: string[];
	quickSearchFields?: FilterQueryField[];
	primaryKeyField?: FilterQueryField;
}

export interface QuickSearchThemeProps {
	ActionIcon?: IconButtonProps;
	DropDownItems?: DropDownResultsProps;
	FilterInput?: FilterInputProps;
	MoreOrLessButton?: ThemedButtonProps;
	PinnedValues?: PinnedValuesProps;
	QuickSearchQuery?: QuickSearchQueryProps;
	QuickSearchWrapper?: QuickSearchWrapperProps;
	ToggleButton?: ToggleButtonThemeProps;
	TreeJointIcon?: IconButtonProps;
}

export interface QuickSearchProps {
	theme?: Partial<QuickSearchThemeProps>;
}
