export interface ArrangerChartTheme {
	onClick?: (e: unknown) => void;
	colors?: string[] | (({ fieldName }: { fieldName: string }) => string);
}

export type ArrangerChartProps = { data: {}; theme: ArrangerChartTheme };

export type ThemeResolver = ({ theme, data }: { theme: ArrangerChartTheme; data: unknown }) => unknown;
