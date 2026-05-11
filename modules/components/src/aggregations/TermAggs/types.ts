import type { AggsGroupCollapsing, AggsGroupFiltering, AggsGroupSorting } from '#aggregations/AggsGroup/types.js';
import type { BucketCountThemeProps } from '#aggregations/BucketCount/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { ToggleButtonThemeProps } from '#ToggleButton/types.js';

type TermAggs = {
	BucketCount: BucketCountThemeProps;
	collapsing: AggsGroupCollapsing;
	filtering: AggsGroupFiltering;
	IncludeExcludeButton: ToggleButtonThemeProps;
	MoreOrLessButton: ThemeCommon.CustomCSS;
	SelectAllButton: ThemeCommon.CustomCSS & { disabled?: boolean };
	sorting: AggsGroupSorting;
};

export default TermAggs;
