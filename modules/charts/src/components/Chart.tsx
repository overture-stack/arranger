import { ChartRenderer } from '#components/ChartRenderer';
import { GQLDataMap, useChartsContext } from '#components/Provider/Provider';
import { useRegisterChart } from '#hooks/useRegisterChart';
import { isEmpty } from 'lodash';
import { useRef } from 'react';

const useChartData = ({
	gqlData,
	transformGQL,
}: {
	gqlData: GQLDataMap;
	transformGQL: (gqlData: GQLDataMap) => any;
}) => {
	if (!gqlData) return null;
	return transformGQL({ gqlData });
};

const useColorMap = ({ chartData, resolver }) => {
	const colorMap = useRef();
	if (chartData && !colorMap.current) {
		colorMap.current = resolver({ chartData });
	}
	return { colorMap: colorMap.current };
};

/**
 * Chart component for rendering data visualizations.
 * Handles data state
 * Sets up shared functionality eg. consistent colors
 *
 * @param fieldName - The data field to visualize
 * @param theme - Arranger style theme configuration for the chart
 * @param DisplayComponent - Custom component for rendering chart display
 */
export const ChartDataContainer = ({ fieldNames, Chart, components, transformGQL, colorMapResolver }) => {
	//TODO: validate fisrt
	//useValidateChart()

	useRegisterChart({ fieldNames });

	// gql data
	const { getChartData } = useChartsContext();
	const { isLoading, isError, data: gqlData } = getChartData({ fieldNames });

	// gql => chart data
	const chartData = useChartData({ gqlData, transformGQL });
	console.log('chart data', chartData);
	// persistent color map
	const { colorMap } = useColorMap({ chartData, resolver: colorMapResolver });

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError}
			isEmpty={isEmpty(chartData)}
			components={components}
			Chart={() => (
				<Chart
					data={chartData}
					colorMap={colorMap}
				/>
			)}
		/>
	);
};
