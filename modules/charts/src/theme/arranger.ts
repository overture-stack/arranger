export interface ArrangerChartTheme {
	onClick?: (e: any) => void;
	//TODO: should be global
	colors?: string[];
	resolveColor?: ({ fieldName }: { fieldName: string }) => string;
}

export type ArrangerChartProps = { data: {}; theme: ArrangerChartTheme };

export type ThemeResolver = ({ theme, source }: { theme: ArrangerChartTheme; source: unknown }) => ArrangerChartTheme;
