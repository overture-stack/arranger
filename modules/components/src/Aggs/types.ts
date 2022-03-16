import { ReactNode } from 'react';
import { SerializedStyles } from '@emotion/react';

import { ToggleButtonThemeProps } from '@/ToggleButton/types';
import { GenericFn } from '@/utils/noopFns';

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
    ActionIcon: IconButton;
    TreeJointIcon: IconButton;
    FilterInput: ReactNode;
    MoreOrLessButton: { css: SerializedStyles };
    TermAgg: {
      ActionIcon: IconButton;
      collapsible: boolean;
      FilterInput: ReactNode;
      MoreOrLessButton: { css: SerializedStyles };
      TreeJointIcon: IconButton;
    };
  } & ToggleButtonThemeProps;
};
