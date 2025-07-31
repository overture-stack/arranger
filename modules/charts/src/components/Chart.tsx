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
	const colorMaps = useRef<Record<string, Map<string, string>>>();

	if (chartData && !colorMaps.current) {
		const mappedColors = Object.entries(chartData).reduce((acc, [key, aggregation]) => {
			const keys = aggregation.map(({ key }) => key);
			return { ...acc, [key]: createColorMap({ keys, colors: globalTheme.colors }) };
		}, {});

		colorMaps.current = mappedColors;
	}

	return { colorMaps: colorMaps.current };
};

/**
 * process data before outputting chart type data
 * eg. consumer data transform to sort items
 */
const resolveChartData = ({ data, transforms }) => {
	console.log('resolve data', data);
	if (isEmpty(data)) return null;
	return transforms.reduce((data, transform) => {
		return transform(data);
	}, data);
};

type BarChartData = {
	key: string;
	displayKey: string;
	docCount: number;
}[];

type SunburstChartData = {
	legend: [];
	outer: [];
	inner: [];
};

/**
 * data transform to convert gql data objects into chart data objects
 */
const ARRANGER_MISSING_DATA_KEY = '__missing__';
const gqlToChartData = (gqlData) => {
	return Object.entries(gqlData).reduce((acc, [key, aggregation]) => {
		// TODO: take 2nd param of type once we have that data available
		const gqlBuckets = aggregation.buckets ? aggregation.buckets : aggregation.range.buckets;
		/**
		 * // TODO: no need for duplicate displayKey after moving to d3, it's for keeping code clean with Nivo config. can't do key || displayKey
		 * 1 - add displayKey property
		 * 2 - rename doc_count to docCount
		 * 3 - map __missing__ key to "No Data"
		 */
		const buckets = gqlBuckets.map(({ key, doc_count }) => ({
			key: key,
			displayKey: key === ARRANGER_MISSING_DATA_KEY ? 'No Data' : key,
			docCount: doc_count,
		}));
		return { ...acc, [key]: buckets };
	}, {});
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
export const Chart = ({ fieldNames, DisplayComponent, components, transformData }) => {
	const { getChartData, globalTheme } = useChartsContext();

	useRegisterChart({ fieldNames });

	// gql data
	// TODO: register and get support multi, but compose transforms
	const { isLoading, isError, data: gqlData } = getChartData({ fieldNames });
	console.log('fieldNames', fieldNames, 'gql data', gqlData);
	// chart data transform + consumer transforms
	const chartData = resolveChartData({
		data: gqlData,
		transforms: [gqlToChartData, transformData].filter(Boolean),
	});
	console.log('cdata', chartData);
	// persistent color map
	const { colorMaps } = useColorMap({ chartData });
	console.log('colormap', colorMaps);
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
				colorMap={colorMaps}
			/>
		);
	}
};
