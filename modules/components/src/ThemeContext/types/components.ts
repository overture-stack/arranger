import type { AggregationsThemeProps } from '#aggregations/types.js';
import type { ButtonThemeProps } from '#Button/types.js';
import type { ArrowIconThemeProps } from '#Icons/ArrowIcon/types.js';
import type { InputThemeProps } from '#Input/types.js';
import type { LoaderContainerThemeProps, LoaderOverlayThemeProps, LoaderThemeProps } from '#Loader/types.js';
import type { QuickSearchThemeProps } from '#QuickSearch/types.js';
import type { SQONViewerThemeProps } from '#SQONViewer/types.js';
import type { TableThemeProps } from '#Table/types.js';
import type { TextHighlightThemeProps } from '#TextHighlight/types.js';

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
