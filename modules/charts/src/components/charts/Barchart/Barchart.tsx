import { ChartDataContainer } from '#components/Chart';
import { arrangerToNivoBarChart } from '#components/charts/Barchart/nivo/config';
import { ChartContainer as ChartViewContainer } from '#components/helper/ChartContainer';
import { GQLDataMap } from '#components/Provider/Provider';
import { ARRANGER_MISSING_DATA_KEY } from '#constants';
import { createColorMap } from '#theme/colors';
import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';

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

const createBarChartTransform =
	({ fieldName }) =>
	({ gqlData }: { gqlData: GQLDataMap }): ChartData | null => {
		if (!gqlData) {
			return null;
		}

		const aggregation = gqlData[fieldName];

		// TODO: take 2nd param of type once we have that data available
		const gqlBuckets = aggregation.buckets ? aggregation.buckets : aggregation.range.buckets;
		/**
		 * 1 - add displayKey property
		 * 2 - rename doc_count to docCount
		 * 3 - map __missing__ key to "No Data"
		 */
		return gqlBuckets.map(({ key, doc_count }) => ({
			key: key,
			displayKey: key === ARRANGER_MISSING_DATA_KEY ? 'No Data' : key,
			docCount: doc_count,
		}));
	};

const colorMapResolver = ({ chartData }) => {
	const keys = chartData.map(({ key }) => key); // specfic chart color map code
	return createColorMap({ keys });
};

type BarChatData = { doc_count: number; key: string }[];
export const Barchart = ({
	fieldName,
	handlers,
	components,
	theme,
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
	const barChartTransform = createBarChartTransform({ fieldName });

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
