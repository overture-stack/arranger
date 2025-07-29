export interface ArrangerChartTheme {
	onClick?: (e: unknown) => void;
	onDataLoad?: (data: any) => any;
	colors?: string[] | (({ fieldName }: { fieldName: string }) => string);
}

export type ArrangerChartProps = { data: {}; theme: ArrangerChartTheme };
