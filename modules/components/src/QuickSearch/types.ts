import { ReactNode } from 'react';

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
}

interface IconButton extends ThemeCommon.CustomCSS {
	fill: string;
	Icon: ReactNode;
	onClick: GenericFn;
	size: number | string;
	transition: string;
}

interface DropDownResultsProps extends ThemeCommon.CustomCSS {
	logoEntityEnabled: boolean;
	logoEntityColor1: string;
	logoEntityColor2: string;
	logoEntityColor3: string;
	logoEntityColor4: string;
	logoEntityColor5: string;
}

interface PinnedValuesProps extends ThemeCommon.CustomCSS {
	enabled: boolean;
}

export interface QuickSearchThemeProps {
	ActionIcon: IconButton;
	DropDownItems: DropDownResultsProps;
	FilterInput: ThemeCommon.CustomCSS;
	MoreOrLessButton: ThemedButtonProps;
	PinnedValues: PinnedValuesProps;
	QuickSearchWrapper: QuickSearchWrapperProps;
	ToggleButton: ToggleButtonThemeProps;
	TreeJointIcon: IconButton;
}
