import { isEmpty } from 'lodash';
import { ReactNode } from 'react';

import { useChartsContext } from '#components/Provider/Provider';
import { useRegisterChart } from '#hooks/useRegisterChart';
import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';
import { ChartText } from './ChartText';

type ChartProps = {
	fieldName: string;
	theme: ArrangerChartTheme;
	headless?: boolean;
	children?: ({
		isLoading,
		isError,
		data,
	}: {
		isLoading: boolean;
		isError: boolean;
		// TODO: Map<string, Aggregations | NumericAggregations>
		data: Map<string, {}> | undefined;
	}) => ReactNode;
	DisplayComponent?: React.ReactElement<ArrangerChartProps>;
};

// TODO: numeric or agg, very hacky property check,
//  no need for this once server config is expanded, then we can check the typename
const resolveData = ({ data, onDataLoad }) => {
	let chartData = {};

	if (data.buckets) {
		chartData = data.buckets;
	} else if (data.range) {
		chartData = data.range.buckets;
	}

	// consumer
	if (onDataLoad) {
		chartData = onDataLoad(chartData);
	}

	return chartData;
};

/**
 * Chart component for rendering data visualizations.
 * Handles data state
 * Sets up shared functionality eg. consistent colors
 *
 * @param fieldName - The data field to visualize
 * @param theme - Arranger style theme configuration for the chart
 * @param children - Child chart components to render within the chart (renders if headless option is true)
 * @param DisplayComponent - Custom component for rendering chart display
 */
export const Chart = ({ fieldName, theme, DisplayComponent }: ChartProps) => {
	const { getChartData, globalTheme } = useChartsContext();

	useRegisterChart({ fieldName });

	const { isLoading, isError, data: chartData } = getChartData({ fieldName });

	if (isLoading) {
		return globalTheme.components.Loader || <ChartText text="Loading..." />;
	}

	if (isError) {
		return globalTheme.components?.ErrorData || <ChartText text="Error" />;
	}

	if (isEmpty(resolvedChartData)) {
		return globalTheme.components?.EmptyData || <ChartText text="No Data Available" />;
	}

	if (DisplayComponent) {
		const resolvedChartData = resolveData({ data: chartData, onDataLoad: theme.onDataLoad });
		return <DisplayComponent data={resolvedChartData} />;
	}
};
