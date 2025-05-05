import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

interface SharedThemeProps {
	defaultDisplayKeys: Record<string, string | number>;
	valueKeys: Record<string, string | number>;
}
export interface BooleanAggregationThemeProps
	extends ThemeCommon.CustomCSS,
		ThemeCommon.BoxModelActiveProperties,
		ThemeCommon.BoxModelDisabledProperties,
		ThemeCommon.BoxModelProperties,
		ThemeCommon.FontActiveProperties,
		ThemeCommon.FontDisabledProperties,
		ThemeCommon.FontProperties,
		SharedThemeProps {
}

interface Bucket {
	doc_count: number;
	key: string;
	key_as_string: string;
	top_hits(_source: string[], size: number): JSON;
	filter_by_term(filter: JSON): JSON;
}

export default interface Props extends ThemeCommon.CustomCSS, SharedThemeProps {
	buckets: Bucket[];
	theme?: RecursivePartial<BooleanAggregationThemeProps>;
}
