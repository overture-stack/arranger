import { ResponsiveBar } from '@nivo/bar';

import { Chart } from '#components/Chart';
import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';
import { arrangerToNivo } from '#theme/nivo';

import { defaultConfig } from './config';

const resolveData = ({ data }) => {
	return data.buckets;
};

// rename to Chart?
// this is our line - use nivo language? only lib stuff?
// less well defined than chart
// Chart is our neat interface to enforce stuff
const BarchartComp = ({ data, theme }: ArrangerChartProps) => {
	const chartData = resolveData({ data });

	// using cloneDeep because structuredClone needs window obj, not SSR compatible
	const resolvedTheme = arrangerToNivo({ theme, source: defaultConfig });
	//console.log('bar chart comp', data, theme, chartData, resolvedTheme);

	return (
		<ResponsiveBar
			data={chartData}
			{...resolvedTheme}
		/>
	);
};

export const Barchart = ({ fieldName, theme }: { fieldName: string; theme: ArrangerChartTheme }) => {
	return (
		<Chart
			fieldName={fieldName}
			theme={theme}
			DisplayComponent={BarchartComp}
		/>
	);
};
