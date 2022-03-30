import { ReactNode } from 'react';
import { SerializedStyles } from '@emotion/react';

import { ThemedButtonProps } from '@/Button/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { ToggleButtonThemeProps } from '@/ToggleButton/types';
import { GenericFn } from '@/utils/noopFns';

import { BucketCountThemeProps } from './BucketCount/types';

interface AggsGroup extends ThemeCommon.CustomCSS {
  collapsedBackground: string;
  collapsible: boolean;
  groupDividerColor: string;
  headerBackground: string;
  headerDividerColor: string;
  headerFontColor: string;
  headerSticky: boolean;
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

interface RangeAgg {
  InputRange: ThemeCommon.CustomCSS;
  NoDataContainer: ThemeCommon.FontProperties;
  RangeLabel: {
    borderRadius: string;
    fontWeight: string;
  } & ThemeCommon.CustomCSS;
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
  FilterInput: ReactNode;
  IncludeExcludeButton: ToggleButtonThemeProps;
  MoreOrLessButton: ThemeCommon.CustomCSS;
  TreeJointIcon: IconButton;
}

export interface AggregationsThemeProps {
  ActionIcon: IconButton;
  AggsGroup: AggsGroup;
  BooleanAgg: BooleanAgg;
  BucketCount: BucketCountThemeProps;
  FilterInput: ReactNode;
  InputRange: SerializedStyles;
  MoreOrLessButton: ThemedButtonProps;
  RangeAgg: RangeAgg;
  TermAgg: TermAgg;
  ToggleButton: ToggleButtonThemeProps;
  TreeJointIcon: IconButton;
}
