import { isEmpty } from 'lodash';
import { useRef } from 'react';

import { useChartsContext } from '#components/Provider/Provider';
import { useRegisterChart } from '#hooks/useRegisterChart';
import { createColorMap } from '#theme/colors';
import { ChartText } from './ChartText';

/**
 * persist color map across renders
 */
const useColorMap = ({ chartData }) => {
	const { globalTheme } = useChartsContext();
	const colorMap = useRef();

	if (chartData && !colorMap.current) {
		const keys = chartData.map(({ key }) => key);
		colorMap.current = createColorMap({ keys, colors: globalTheme.colors });
	}

	return { colorMap: colorMap.current };
};

/**
 * process data before outputting chart type data
 * eg. consumer data transform to sort items
 */
const resolveChartData = ({ data, transforms }) => {
	if (!data) return null;
	return transforms.reduce((data, transform) => {
		return transform(data);
	}, data);
};

type ChartData = {
	key: string;
	displayKey: string;
	docCount: number;
}[];
/**
 * data transform to convert gql data objects into chart data objects
 */
const ARRANGER_MISSING_DATA_KEY = '__missing__';
const gqlToChartData = (gqlData): ChartData => {
	// TODO: take 2nd param of type once we have that data available
	const gqlBuckets = gqlData.buckets ? gqlData.buckets : gqlData.range.buckets;
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

/**
 * Chart component for rendering data visualizations.
 * Handles data state
 * Sets up shared functionality eg. consistent colors
 *
 * @param fieldName - The data field to visualize
 * @param theme - Arranger style theme configuration for the chart
 * @param DisplayComponent - Custom component for rendering chart display
 */
export const Chart = ({ fieldName, DisplayComponent, components, transformData }) => {
	const { getChartData, globalTheme } = useChartsContext();

	useRegisterChart({ fieldName });

	// gql data
	const { isLoading, isError, data: gqlData } = getChartData({ fieldName });

	// chart data transform + consumer transforms
	const chartData = resolveChartData({
		data: gqlData,
		transforms: [gqlToChartData, transformData].filter(Boolean),
	});

	// persistent color map
	const { colorMap } = useColorMap({ chartData });

	if (isLoading) {
		const LoaderComponent = globalTheme?.components?.Loader || components.Loader;
		return LoaderComponent ? <LoaderComponent /> : <ChartText text="Loading..." />;
	}

	if (isError) {
		const ErrorComponent = globalTheme?.components?.ErrorData || components.ErrorData;
		return ErrorComponent ? <ErrorComponent /> : <ChartText text="Error" />;
	}

	if (isEmpty(gqlData)) {
		const EmptyComponent = globalTheme?.components?.EmptyData || components.EmptyData;
		return EmptyComponent ? <EmptyComponent /> : <ChartText text="No Data Available" />;
	}

	if (DisplayComponent) {
		return (
			<DisplayComponent
				data={chartData}
				colorMap={colorMap}
			/>
		);
	}
};
