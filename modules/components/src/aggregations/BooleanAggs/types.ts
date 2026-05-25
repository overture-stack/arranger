import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

type BooleanAggs = {
	BucketCount: BucketCountThemeProps;
	ToggleButton: ToggleButtonThemeProps;
};

type SharedThemeProps = {
	defaultDisplayKeys: Record<string, string | number>;
	valueKeys: Record<string, string | number>;
};

export type BooleanAggsThemeProps = ThemeCommon.CustomCSS &
	ThemeCommon.BoxModelActiveProperties &
	ThemeCommon.BoxModelDisabledProperties &
	ThemeCommon.BoxModelProperties &
	ThemeCommon.FontActiveProperties &
	ThemeCommon.FontDisabledProperties &
	ThemeCommon.FontProperties &
	SharedThemeProps;

type Bucket = {
	doc_count: number;
	key: string;
	key_as_string: string;
	top_hits(_source: string[], size: number): JSON;
	filter_by_term(filter: JSON): JSON;
};

type Props = ThemeCommon.CustomCSS &
	SharedThemeProps & {
		buckets: Bucket[];
		theme?: RecursivePartial<BooleanAggsThemeProps>;
	};

export default Props;
