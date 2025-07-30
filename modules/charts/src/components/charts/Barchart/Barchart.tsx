import { Chart } from '#components/Chart';
import { arrangerToNivoBarChart } from '#components/charts/Barchart/nivo/config';
import { ChartText } from '#components/ChartText';
import { ChartContainer } from '#components/helper/ChartContainer';
import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';

type BarChartProps = {
	data: any;
	theme: any;
};

/**
 * Resolve to a Nivo Bar chart component
 */
export const BarChartView = ({ data, theme, colorMap, onClick }: BarChartProps) => {
	const resolvedTheme = arrangerToNivoBarChart({ theme, colorMap, onClick });

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveBar
				data={data}
				{...resolvedTheme}
			/>
		</div>
	);
};

const validateChart = () => {
	console.log('validating chart..');
	return true;
};

type BarChatData = { doc_count: number; key: string }[];
export const Barchart = ({
	fieldName,
	handlers,
	components,
	theme,
	transformData,
}: {
	theme: any;
	fieldName: string;
	handlers?: { onClick: (config) => void };
	transformData?: (data: unknown) => BarChatData;
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
				transformData={transformData}
				components={components}
				DisplayComponent={({ data, colorMap }) => {
					// this will re-render based on the internal chart fetching updates in "Chart" component
					return (
						<BarChartView
							data={data}
							theme={theme}
							colorMap={colorMap}
							onClick={handlers?.onClick}
						/>
					);
				}}
			/>
		</ChartContainer>
	);
};
