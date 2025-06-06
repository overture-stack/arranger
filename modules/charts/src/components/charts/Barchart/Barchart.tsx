import { ResponsiveBar } from '@nivo/bar';

import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';
import { Chart } from '#components/Chart';
import { arrangerToNivo } from '#theme/nivo';

import { defaultConfig } from './config';

const BarchartComp = ({ data, theme }: ArrangerChartProps) => {
	const nivoConfig = arrangerToNivo({ theme, source: defaultConfig });

	return (
		<ResponsiveBar
			data={data}
			{...nivoConfig}
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
