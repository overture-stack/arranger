import { AggregationsThemeProps } from '@/Aggs/types';
import { DataTableThemeProps } from '@/DataTable/types';
import { ArrowIconThemeProps } from '@/Icons/ArrowIcon/types';
import { SQONViewerThemeProps } from '@/SQONViewer/types';
import { TextHighlightThemeProps } from '@/TextHighlight/types';
import { RecursivePartial } from '@/utils/types';

export interface Components {
  Aggregations: AggregationsThemeProps;
  ArrowIcon: ArrowIconThemeProps;
  Table: DataTableThemeProps;
  TextHighlight: TextHighlightThemeProps;
  SQONViewer: SQONViewerThemeProps;
}

export type ComponentsOptions = RecursivePartial<Components>;
