import type { SerializedStyles } from '@emotion/react';

import type { ThemedButtonProps } from '#Button/types.js';
import type { APIFetcherFn, SQONType } from '#DataContext/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { ToggleButtonThemeProps } from '#ToggleButton/types.js';

import type AggsGroup from './AggsGroup/types.js';
import type BooleanAggs from './BooleanAggs/types.js';
import type { BucketCountThemeProps } from './BucketCount/types.js';
import type TermAggs from './TermAggs/types.js';

export type AggsStateProps = JSX.IntrinsicAttributes & {
	apiFetcher?: APIFetcherFn;
	documentType?: string;
	render: (props: RenderProps) => React.ReactNode; // placeholder to hooks
	rowIdFieldName?: string;
	sqon?: SQONType;
	url?: string;
};

type RangeAggs = ThemeCommon.CustomCSS & {
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
};

export type AggregationsThemeProps = {
	AggsGroup: AggsGroup;
	BooleanAggs: BooleanAggs;
	BucketCount: BucketCountThemeProps;
	FilterInput: ThemeCommon.CustomCSS;
	InputRange: SerializedStyles;
	MoreOrLessButton: ThemedButtonProps;
	RangeAggs: RangeAggs;
	TermAggs: TermAggs;
	ToggleButton: ToggleButtonThemeProps;
};
