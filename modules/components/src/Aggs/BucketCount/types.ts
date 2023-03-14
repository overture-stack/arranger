import { HTMLProps } from 'react';

import { ThemeCommon } from '@/ThemeContext/types';

export type BucketCountThemeProps = ThemeCommon.CustomCSS &
	ThemeCommon.BoxModelActiveProperties &
	ThemeCommon.BoxModelDisabledProperties &
	ThemeCommon.BoxModelProperties &
	ThemeCommon.FontActiveProperties &
	ThemeCommon.FontDisabledProperties &
	ThemeCommon.FontProperties;

export default interface Props extends HTMLProps<HTMLButtonElement>, ThemeCommon.CustomCSS {
	theme?: Partial<BucketCountThemeProps>;
}
