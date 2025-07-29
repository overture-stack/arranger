import { isEmpty } from 'lodash';

import { useChartsContext } from '#components/Provider/Provider';
import { useRegisterChart } from '#hooks/useRegisterChart';
import { createColorMap } from '#theme/colors';
import { useRef } from 'react';
import { ChartText } from './ChartText';

/**
 * persist color map across renders
 */
const useColorMap = ({ chartData }) => {
	const { globalTheme } = useChartsContext();

	const colorMap = useRef();
	if (!colorMap.current && chartData) {
		// TODO: NumericAgg
		const keys = chartData?.buckets.map((bucket) => bucket.key);
		colorMap.current = createColorMap({ keys, colors: globalTheme.colors });
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
export const Chart = ({ fieldName, DisplayComponent, components }) => {
	const { getChartData, globalTheme } = useChartsContext();

	useRegisterChart({ fieldName });

	const { isLoading, isError, data: chartData } = getChartData({ fieldName });

	const { colorMap } = useColorMap({ chartData });

	if (isLoading) {
		const LoaderComponent = globalTheme?.components?.Loader || components.Loader;
		return LoaderComponent ? <LoaderComponent /> : <ChartText text="Loading..." />;
	}

	if (isError) {
		const ErrorComponent = globalTheme?.components?.ErrorData || components.ErrorData;
		return ErrorComponent ? <ErrorComponent /> : <ChartText text="Error" />;
	}

	if (isEmpty(chartData)) {
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
