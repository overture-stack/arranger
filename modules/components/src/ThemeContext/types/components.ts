import { AggregationsThemeProps } from '@/Aggs/types';
import { ButtonStyleProps } from '@/Button/types';
import { InputThemeProps } from '@/Input/types';
import { ArrowIconThemeProps } from '@/Icons/ArrowIcon/types';
import { QuickSearchThemeProps } from '@/QuickSearch/types';
import { SpinnerThemeProps } from '@/Spinner/types';
import { SQONViewerThemeProps } from '@/SQONViewer/types';
import { TableThemeProps } from '@/Table/types';
import { TextHighlightThemeProps } from '@/TextHighlight/types';

export interface Components {
	Aggregations: AggregationsThemeProps;
	ArrowIcon: ArrowIconThemeProps;
	Button: ButtonStyleProps;
	Input: InputThemeProps;
	QuickSearch: QuickSearchThemeProps;
	Spinner: SpinnerThemeProps;
	SQONViewer: SQONViewerThemeProps;
	Table: TableThemeProps;
	TextHighlight: TextHighlightThemeProps;
}
