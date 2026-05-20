import type { ThemeCommon } from '#ThemeContext/types/index.js';

export type ArrowIconThemeProps = ThemeCommon.CustomCSS & {
	activeFill: string;
	disabledFill: string;
	fill: string;
	size: string | number;
	transition: string;
};

type Props = ThemeCommon.CustomCSS & {
	disabled?: boolean;
	isTreeJoint?: boolean;
	pointUp?: boolean;
	theme?: Partial<ArrowIconThemeProps>;
};

export default Props;
