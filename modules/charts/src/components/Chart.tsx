import { isEmpty } from 'lodash';
import { ReactNode, useEffect, useRef } from 'react';

import { ChartRenderer } from '#components/ChartRenderer';
import { GQLDataMap, useChartsContext } from '#components/Provider/Provider';

/**
 * Transforms GraphQL data using the provided transformation function.
 *
 * @param { gqlData } - Raw GraphQL data map from API response
 * @param { transformGQL } - Function to transform GraphQL data to chart format
 * @returns Transformed chart data or null if no data provided
 */
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

/**
 * Custom hook that creates and maintains a persistent color map for chart data.
 * Uses useRef to ensure color consistency across re-renders.
 *
 * @param { chartData } - Chart data to generate colors for
 * @param { resolver } - Function that creates color map from chart data
 * @returns Object containing the generated color map
 */
const useColorMap = ({ chartData, resolver }) => {
	const colorMap = useRef();
	if (chartData && !colorMap.current) {
		colorMap.current = resolver({ chartData });
	}
	return { colorMap: colorMap.current };
};

/**
 * Main chart container component that orchestrates the complete chart data pipeline.
 * Handles registration, data fetching, transformation, and rendering with error boundaries.
 *
 * @param props - Chart container configuration
 * @param props.fieldNames - Array of field names to query Arranger for
 * @param props.Chart - Chart component to render with transformed data
 * @param props.components - Custom components for loading/error/empty states
 * @param props.chartConfig - Chart configuration object for registration
 * @param props.transformGQL - Function to transform GraphQL data to chart format
 * @param props.colorMapResolver - Function to generate consistent color mapping
 * @returns JSX element with rendered chart or appropriate fallback component
 */
export const ChartDataContainer = ({
	fieldNames,
	Chart,
	components,
	chartConfig,
	transformGQL,
	colorMapResolver,
}: {
	fieldNames: string[];
	Chart: ReactNode;
	components: any;
	chartConfig: any;
	transformGQL: any;
	colorMapResolver: any;
}) => {
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
