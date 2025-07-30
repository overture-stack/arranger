import { Chart } from '#components/Chart';
import { ChartText } from '#components/ChartText';
import { ChartContainer } from '#components/helper/ChartContainer';
import { ArrangerChartTheme } from '#theme/arranger';
import { arrangerToNivoBarChart } from '#theme/nivo/nivo';
import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';

type BarChartProps = {
	data: any;
	theme: any;
};

/**
 * Resolve to a Nivo Bar chart component
 */
export const BarChartView = ({ data, theme, colorMap }: BarChartProps) => {
	const resolvedTheme = arrangerToNivoBarChart({ theme, colorMap });

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
	theme,
	handlers,
	components,
	transformData,
}: {
	fieldName: string;
	theme: ArrangerChartTheme;
	handlers?: any;
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
						/>
					);
				}}
			/>
		</ChartContainer>
	);
};
