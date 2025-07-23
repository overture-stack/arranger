import { ResponsiveBar } from '@nivo/bar';

import { Chart } from '#components/Chart';
import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';
import { arrangerToNivoBarChart } from '#theme/nivo/nivo';

/**
 * Resolve to a Nivo Bar chart component
 */
export const BarchartComp = ({ data, theme }: ArrangerChartProps) => {
	const resolvedTheme = arrangerToNivoBarChart({ data, theme });

	return (
		<ResponsiveBar
			data={data}
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
