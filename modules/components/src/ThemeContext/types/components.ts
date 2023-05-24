import { AggregationsThemeProps } from '@/Aggs/types';
import { ButtonThemeProps } from '@/Button/types';
import { InputThemeProps } from '@/Input/types';
import { ArrowIconThemeProps } from '@/Icons/ArrowIcon/types';
import { QuickSearchThemeProps } from '@/QuickSearch/types';
import {
	LoaderContainerThemeProps,
	LoaderOverlayThemeProps,
	LoaderThemeProps,
} from '@/Loader/types';
import { SQONViewerThemeProps } from '@/SQONViewer/types';
import { TableThemeProps } from '@/Table/types';
import { TextHighlightThemeProps } from '@/TextHighlight/types';

export interface Components {
	Aggregations: AggregationsThemeProps;
	ArrowIcon: ArrowIconThemeProps;
	Button: ButtonThemeProps;
	Input: InputThemeProps;
	Loader: LoaderThemeProps;
	LoaderContainer: LoaderContainerThemeProps;
	LoaderOverlay: LoaderOverlayThemeProps;
	QuickSearch: QuickSearchThemeProps;
	SQONViewer: SQONViewerThemeProps;
	Table: TableThemeProps;
	TextHighlight: TextHighlightThemeProps;
}
