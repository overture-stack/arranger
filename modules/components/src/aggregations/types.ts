import type { SerializedStyles } from '@emotion/react';
import type { ReactNode } from 'react';

import type { ThemedButtonProps } from '#Button/types.js';
import type { APIFetcherFn, SQONType } from '#DataContext/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { ToggleButtonThemeProps } from '#ToggleButton/types.js';
import type { GenericFn } from '#utils/noops.js';

import type { BucketCountThemeProps } from './BucketCount/types.js';

interface AggsGroup extends ThemeCommon.CustomCSS {
	collapsedBackground: string;
	collapsible: boolean;
	groupDividerColor: string;
	headerBackground: string;
	headerDividerColor: string;
	headerFontColor: string;
	headerSticky: boolean;
}

export interface AggsStateProps extends JSX.IntrinsicAttributes {
	apiFetcher?: APIFetcherFn;
	documentType?: string;
	render: (props: RenderProps) => React.ReactNode; // placeholder to hooks
	rowIdFieldName?: string;
	sqon?: SQONType;
	url?: string;
}

interface BooleanAgg {
	BucketCount: BucketCountThemeProps;
	ToggleButton: ToggleButtonThemeProps;
}

interface IconButton extends ThemeCommon.CustomCSS {
	fill: string;
	Icon: ReactNode;
	onClick: GenericFn;
	size: number | string;
	transition: string;
}

interface RangeAgg extends ThemeCommon.CustomCSS {
	InputRange: ThemeCommon.CustomCSS;
	NoDataContainer: ThemeCommon.FontProperties;
	RangeLabel: ThemeCommon.BoxModelProperties & ThemeCommon.FontProperties & ThemeCommon.CustomCSS;
	RangeSlider: {
		disabledBackground: string;
		disabledBorderColor: string;
	} & ThemeCommon.BoxModelProperties &
		ThemeCommon.CustomCSS;
	RangeTrack: {
		background: string;
		disabledBackground: string;
		disabledInBackground: string;
		disabledOutBackground: string;
		inBackground: string;
		outBackground: string;
	} & ThemeCommon.CustomCSS;
	RangeWrapper: ThemeCommon.CustomCSS;
}

interface TermAgg {
	ActionIcon: IconButton;
	BucketCount: BucketCountThemeProps;
	collapsible: boolean;
	FilterInput: ThemeCommon.CustomCSS;
	IncludeExcludeButton: ToggleButtonThemeProps;
	MoreOrLessButton: ThemeCommon.CustomCSS;
	TreeJointIcon: IconButton;
}

export interface AggregationsThemeProps {
	ActionIcon: IconButton;
	AggsGroup: AggsGroup;
	BooleanAgg: BooleanAgg;
	BucketCount: BucketCountThemeProps;
	FilterInput: ThemeCommon.CustomCSS;
	InputRange: SerializedStyles;
	MoreOrLessButton: ThemedButtonProps;
	RangeAgg: RangeAgg;
	TermAgg: TermAgg;
	ToggleButton: ToggleButtonThemeProps;
	TreeJointIcon: IconButton;
}
