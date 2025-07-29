import type { ThemeCommon } from '#ThemeContext/types/index.js';

export type SortAlphaIconThemeProps = ThemeCommon.CustomCSS & {
	activeFill: string;
	disabledFill: string;
	fill: string;
	size: string | number;
};

type Props = ThemeCommon.CustomCSS & {
	descending: boolean;
	disabled?: boolean;
	theme?: Partial<SortAlphaIconThemeProps>;
};

export default Props;
