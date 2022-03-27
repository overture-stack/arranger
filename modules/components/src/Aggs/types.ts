import { ReactNode } from 'react';
import { SerializedStyles } from '@emotion/react';

import { ToggleButtonThemeProps } from '@/ToggleButton/types';
import { GenericFn } from '@/utils/noopFns';

import { BucketCountThemeProps } from './BucketCount/types';

interface IconButton {
  className: string;
  fill: string;
  Icon: ReactNode;
  onClick: GenericFn;
  size: number | string;
  transition: string;
}

export type AggregationsThemeProps = {
  Aggregations: {
    ActionIcon: IconButton;
    AggsGroup: {
      className: string;
      collapsedBackground: string;
      collapsible: boolean;
      groupDividerColor: string;
      headerBackground: string;
      headerDividerColor: string;
      headerFontColor: string;
      headerSticky: boolean;
    };
    BooleanAgg: { BucketCount: BucketCountThemeProps; ToggleButton: ToggleButtonThemeProps };
    BucketCount: BucketCountThemeProps;
    FilterInput: ReactNode;
    InputRange: SerializedStyles;
    MoreOrLessButton: { css: SerializedStyles };
    RangeAgg: {
      InputRange: {
        css: SerializedStyles;
      };
      NoDataContainer: {
        fontColor: string;
        fontSize: string;
      };
      RangeLabel: {
        borderRadius: string;
        css: SerializedStyles;
        fontWeight: string;
      };
      RangeSlider: {
        background: string;
        borderColor: string;
        css: SerializedStyles;
        disabledBackground: string;
        disabledBorderColor: string;
      };
      RangeTrack: {
        background: string;
        disabledBackground: string;
        disabledInBackground: string;
        disabledOutBackground: string;
        inBackground: string;
        outBackground: string;
      };
      RangeWrapper: { css: SerializedStyles };
    };
    TermAgg: {
      ActionIcon: IconButton;
      BucketCount: BucketCountThemeProps;
      collapsible: boolean;
      FilterInput: ReactNode;
      IncludeExcludeButton: ToggleButtonThemeProps;
      MoreOrLessButton: { css: SerializedStyles };
      TreeJointIcon: IconButton;
    };
    ToggleButton: ToggleButtonThemeProps;
    TreeJointIcon: IconButton;
  };
};
