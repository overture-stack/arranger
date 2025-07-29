import { Chart } from '#components/Chart';
import { ChartText } from '#components/ChartText';
import { ChartContainer } from '#components/helper/ChartContainer';
import { useChartsContext } from '#components/Provider/Provider';
import { ArrangerChartTheme } from '#theme/arranger';
import { createColorMap } from '#theme/colors';
import { arrangerToNivoBarChart } from '#theme/nivo/nivo';
import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { useMemo, useRef } from 'react';

type BarChartProps = {
	data: any;
	theme: any;
};

/**
 * Resolve to a Nivo Bar chart component
 */
export const BarChartView = ({ data, theme }: BarChartProps) => {
	const { globalTheme } = useChartsContext();

	// pull out buckets from data
	const chartData = data.buckets;

	// theme value depending on data provided, and scoped to a single instance of a Charts
	const dataKeys = useMemo(() => chartData.map(({ key }) => key), [chartData]);
	const colorMap = useRef();
	colorMap.current = createColorMap({ keys: dataKeys, colors: globalTheme.colors });

	const resolvedTheme = arrangerToNivoBarChart({ theme, colorMap: colorMap.current });
	console.log('chart', chartData, resolvedTheme);
	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveBar
				data={chartData}
				{...resolvedTheme}
			/>
		</div>
	);
};

const validateChart = () => {
	console.log('validating chart..');
	return true;
};

export const Barchart = ({
	fieldName,
	theme,
	dataHandlers,
	components,
}: {
	fieldName: string;
	theme: ArrangerChartTheme;
	dataHandlers?: any;
	components?: {
		Loader?: any;
		ErrorData?: any;
		EmptyData?: any;
	};
}) => {
	// this should only be called on Barchart render
	const isValidated = validateChart();

	if (!isValidated) {
		return (
			<ChartContainer>
				<ChartText text="Invalid chart config" />
			</ChartContainer>
		);
	}

	return (
		<ChartContainer>
			<Chart
				fieldName={fieldName}
				dataHandlers={dataHandlers}
				components={components}
				DisplayComponent={({ data }) => (
					// this will re-render based on the internal chart fetching updates in "Chart" component
					<BarChartView
						data={data}
						theme={theme}
					/>
				)}
			/>
		</ChartContainer>
	);
};
