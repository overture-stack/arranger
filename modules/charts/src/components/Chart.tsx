import { isEmpty } from 'lodash';
import { useEffect } from 'react';

import { useChartsContext } from '#components/Provider/Provider';
import { useRegisterChart } from '#hooks/useRegisterChart';
import { ChartText } from './ChartText';

/**
 * Chart component for rendering data visualizations.
 * Handles data state
 * Sets up shared functionality eg. consistent colors
 *
 * @param fieldName - The data field to visualize
 * @param theme - Arranger style theme configuration for the chart
 * @param DisplayComponent - Custom component for rendering chart display
 */
export const Chart = ({ fieldName, theme, DisplayComponent, components, dataHandlers }) => {
	const { getChartData } = useChartsContext();

	useEffect(() => {
		useRegisterChart({ fieldName });
	}, [fieldName]);

	const { isLoading, isError, data: chartData } = getChartData({ fieldName });

	if (isLoading) {
		return components.Loader || <ChartText text="Loading..." />;
	}

	if (isError) {
		return components.ErrorData || <ChartText text="Error" />;
	}

	if (isEmpty(resolvedChartData)) {
		return components.EmptyData || <ChartText text="No Data Available" />;
	}

	if (DisplayComponent) {
		const resolvedChartData = resolveData({ data: chartData, onDataLoad: theme.onDataLoad });
		return <DisplayComponent data={resolvedChartData} />;
	}
};
