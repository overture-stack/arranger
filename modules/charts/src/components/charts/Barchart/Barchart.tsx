import { ChartDataContainer } from '#components/Chart';
import { arrangerToNivoBarChart } from '#components/charts/Barchart/nivo/config';
import { ChartContainer as ChartViewContainer } from '#components/helper/ChartContainer';
import { createColorMap } from '#theme/colors';
import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';
import { createBarChartTransform } from './dataTransform';
import { useValidateInput } from './hooks/useValidateInput';

type BarChartProps = {
	data: any;
	theme: any;
};

/**
 * Resolve to a Nivo Bar chart component
 */
export const BarChartView = ({ data, theme, colorMap, onClick }: BarChartProps) => {
	const resolvedTheme = useMemo(
		() => arrangerToNivoBarChart({ theme, colorMap, onClick }),
		[theme, colorMap, onClick],
	);

	console.log('chart', data, resolvedTheme, colorMap);
	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveBar
				data={data}
				{...resolvedTheme}
			/>
		</div>
	);
};

const colorMapResolver = ({ chartData }) => {
	const keys = chartData.map(({ key }) => key); // specfic chart color map code
	return createColorMap({ keys });
};

type NumericAggregationsOptions = {
	ranges?: any;
};
type BarChartPropsQuery = {
	variables?: NumericAggregationsOptions;
	transformData?: (data: unknown) => BarChatData;
};

type BarChatData = { doc_count: number; key: string }[];
export const Barchart = ({
	fieldName,
	query,
	handlers,
	components,
	theme,
}: {
	theme: any;
	query: BarChartPropsQuery;
	fieldName: string;
	handlers?: { onClick: (config) => void };
	components?: {
		Loader?: any;
		ErrorData?: any;
		EmptyData?: any;
	};
}) => {
	// validate and return chart aggregation config if successful
	const chartAggregation = useValidateInput({ fieldName, options });

	const barChartTransform = createBarChartTransform(chartAggregation);

	return (
		<ChartDataContainer
			fieldNames={[fieldName]}
			transformGQL={barChartTransform}
			colorMapResolver={colorMapResolver}
			components={components}
			Chart={({ data, colorMap }) => (
				<ChartViewContainer>
					<BarChartView
						data={data}
						colorMap={colorMap}
						theme={theme}
						onClick={handlers?.onClick}
					/>
				</ChartViewContainer>
			)}
		/>
	);
};
