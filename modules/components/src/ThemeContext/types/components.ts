import { AggregationsThemeProps } from '@/Aggs/types';
import { ArrowIconThemeProps } from '@/Icons/ArrowIcon/types';
import { SQONViewerThemeProps } from '@/SQONViewer/types';
import { TableThemeProps } from '@/Table/types';
import { TextHighlightThemeProps } from '@/TextHighlight/types';
import { RecursivePartial } from '@/utils/types';

export interface Components {
  Aggregations: AggregationsThemeProps;
  ArrowIcon: ArrowIconThemeProps;
  Table: TableThemeProps;
  TextHighlight: TextHighlightThemeProps;
  SQONViewer: SQONViewerThemeProps;
}

export type ComponentsOptions = RecursivePartial<Components>;
