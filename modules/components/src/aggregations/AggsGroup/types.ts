import type { ReactNode } from 'react';

import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { GenericFn } from '#utils/noops.js';
import AggsGroup from './AggsGroup.jsx';

type IconButton = ThemeCommon.CustomCSS & {
	fill: string;
	Icon: ReactNode;
	onClick: GenericFn;
	size: number | string;
	transition: string;
};

type AggsGroupModifier = IconButton & {
	disabled: boolean;
};

type AggsGroup = ThemeCommon.CustomCSS & {
	collapsedBackground: string;
	collapsing: AggsGroupModifier;
	filtering: AggsGroupModifier;
	groupDividerColor: string;
	headerBackground: string;
	headerDividerColor: string;
	headerFontColor: string;
	headerSticky: boolean;
	sorting: AggsGroupModifier;
};

export type AggsGroupCollapsing = AggsGroupModifier & {};

export type AggsGroupFiltering = AggsGroupModifier & {
	inputField: ThemeCommon.CustomCSS & {
		Component: ReactNode;
	};
};

export type AggsGroupSorting = AggsGroupModifier & {
	descending: boolean;
};

export default AggsGroup;
