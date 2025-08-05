import { ChartRenderer } from '#components/ChartRenderer';
import { GQLDataMap, useChartsContext } from '#components/Provider/Provider';
import { isEmpty } from 'lodash';
import { useEffect, useRef } from 'react';

const transformData = ({
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
export const ChartDataContainer = ({ fieldNames, Chart, components, chartConfig, transformGQL, colorMapResolver }) => {
	const { registerChart, deregisterChart } = useChartsContext();

	useEffect(() => {
		try {
			registerChart(chartConfig);
		} catch (e) {
			console.error(`Cannot register ${JSON.stringify(chartConfig)} with Arranger Charts provider.`);
			console.error(e);
		}
		return () => {
			deregisterChart({ fieldNames });
		};
	}, [fieldNames]);

	// gql data
	const { getChartData } = useChartsContext();
	const { isLoading, isError, data: gqlData } = getChartData({ fieldNames });

	// gql => chart data
	const chartData = transformData({ gqlData, transformGQL });

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
