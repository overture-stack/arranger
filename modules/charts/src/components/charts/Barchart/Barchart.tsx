import { ResponsiveBar } from '@nivo/bar';

import { Chart } from '#components/Chart';
import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';
import { arrangerToNivoBarChart } from '#theme/nivo';

import { defaultConfig } from './config';

const resolveData = ({ data }) => {
	return data.buckets;
};

export const BarchartComp = ({ data, theme }: ArrangerChartProps) => {
	const chartData = resolveData({ data });

	// theme => specific chart config
	// using cloneDeep because structuredClone needs window obj, not SSR compatible
	const resolvedTheme = arrangerToNivoBarChart({ source: defaultConfig, data, theme });
	console.log('restolved', resolvedTheme, theme);
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
