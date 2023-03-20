import { AggregationsThemeProps } from '@/Aggs/types';
import { QuickSearchThemeProps } from '@/QuickSearch/types';
import { ArrowIconThemeProps } from '@/Icons/ArrowIcon/types';
import { SQONViewerThemeProps } from '@/SQONViewer/types';
import { TableThemeProps } from '@/Table/types';
import { TextHighlightThemeProps } from '@/TextHighlight/types';
import { RecursivePartial } from '@/utils/types';

export interface Components {
	Aggregations: AggregationsThemeProps;
	ArrowIcon: ArrowIconThemeProps;
	QuickSearch: QuickSearchThemeProps;
	SQONViewer: SQONViewerThemeProps;
	Table: TableThemeProps;
	TextHighlight: TextHighlightThemeProps;
}

export type ComponentsOptions = RecursivePartial<Components>;
