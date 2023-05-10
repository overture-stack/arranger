import { AggregationsThemeProps } from '@/Aggs/types';
import { QuickSearchThemeProps } from '@/QuickSearch/types';
import { ArrowIconThemeProps } from '@/Icons/ArrowIcon/types';
import { SpinnerThemeProps } from '@/Spinner/types';
import { SQONViewerThemeProps } from '@/SQONViewer/types';
import { TableThemeProps } from '@/Table/types';
import { TextHighlightThemeProps } from '@/TextHighlight/types';

export interface Components {
	Aggregations: AggregationsThemeProps;
	ArrowIcon: ArrowIconThemeProps;
	QuickSearch: QuickSearchThemeProps;
	Spinner: SpinnerThemeProps;
	SQONViewer: SQONViewerThemeProps;
	Table: TableThemeProps;
	TextHighlight: TextHighlightThemeProps;
}
