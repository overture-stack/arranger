import type { ThemeCommon } from '#ThemeContext/types/index.js';

export type TermAggs = {
	BucketCount: BucketCountThemeProps;
	collapsing: AggsGroupCollapsing;
	filtering: AggsGroupFiltering;
	IncludeExcludeButton: ToggleButtonThemeProps;
	MoreOrLessButton: ThemeCommon.CustomCSS;
	SelectAllButton: ThemeCommon.CustomCSS & { disabled?: boolean };
	sorting: AggsGroupSorting;
};
