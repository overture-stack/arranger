export interface ArrangerChartTheme {
	onClick: () => void;
	colors: string[];
}

export type ArrangerChartProps = { data: {}; theme: ArrangerChartTheme };

export type ThemeResolver = ({ theme, source }: { theme: ArrangerChartTheme; source: unknown }) => ArrangerChartTheme;
