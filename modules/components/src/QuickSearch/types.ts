import { FC, ReactElement } from 'react';

import { ButtonThemeProps, ThemedButtonProps } from '@/Button/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { ToggleButtonThemeProps } from '@/ToggleButton/types';
import { GenericFn } from '@/utils/noops';
import { RecursivePartial } from '@/utils/types';

export interface SearchResult {
	// TODO: validate these
	entityName: string;
	result: string;
	primaryKey: string;
	input: string;
	index: number;
}

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

interface PinnedValuesProps extends ButtonThemeProps {
	enabled: boolean;
	PinnedValueComponent: FC;
}

interface FilterInputProps extends ThemeCommon.BoxModelProperties, ThemeCommon.CustomCSS {
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
	searchLowercase: boolean;
	searchTextDelimiters: string[];
	primaryKeyField?: FilterQueryField;
}

export type SearchFieldNames = string | string[];
export type SearchFieldNamesGlobal = SearchFieldNames | Record<string, SearchFieldNames>;

export interface QuickSearchContextThemeProps extends QuickSearchWrapperProps {
	fieldNames: SearchFieldNamesGlobal;
	displayFieldName: SearchFieldNamesGlobal;
	placeholder: string;
}

export interface QuickSearchThemeProps extends QuickSearchContextThemeProps {
	ActionIcon: IconButtonProps;
	DropDownItems: DropDownResultsProps;
	FilterInput: FilterInputProps;
	MoreOrLessButton: ThemedButtonProps;
	PinnedValues: PinnedValuesProps;
	QuickSearchQuery: QuickSearchQueryProps;
	QuickSearchWrapper: QuickSearchWrapperProps;
	ToggleButton: ToggleButtonThemeProps;
	TreeJointIcon: IconButtonProps;
}

export interface QuickSearchProps {
	disabled?: boolean;
	displayFieldName?: string;
	fieldNames?: SearchFieldNames;
	name?: string;
	theme?: RecursivePartial<QuickSearchThemeProps>;
}

export type QuickSearchComponent = (props: QuickSearchProps) => ReactElement;

export interface UseSearchFieldsProps {
	allowlist?: string[];
	disabled?: boolean;
	displayFieldName?: string;
	fieldNames?: SearchFieldNames;
	instanceId?: string;
}
