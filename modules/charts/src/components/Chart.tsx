import { cloneDeep, isEmpty, merge } from 'lodash';
import { ReactNode, useEffect, useRef } from 'react';

import { ChartContainer } from '#components/helper/ChartContainer';
import { useChartsContext } from '#components/Provider/Provider';
import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';
import { createColorMap } from '#theme/colors';

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
 * @param headless - Headless UI option (uses children prop)
 * @param children - Child chart components to render within the chart (renders if headless option is true)
 * @param DisplayComponent - Custom component for rendering chart display
 */
export const Chart = ({ fieldName, theme, headless, children, DisplayComponent }: ChartProps) => {
	// Add validation, field vs fieldName, theme object, etc
	// validate
	if (fieldName === undefined) {
		throw Error(`Please provide "fieldName" prop.`);
	}

	const { registerChart, deregisterChart, getChartData, globalTheme } = useChartsContext();

	useEffect(() => {
		try {
			registerChart({ fieldName });
		} catch (e) {
			console.error(`Cannot register chart ${fieldName} with Arranger Charts provider.`);
			console.error(e);
		}
		return () => {
			deregisterChart({ fieldName });
		};
	}, []);

	const { isLoading, isError, data: chartData } = getChartData({ fieldName });

	// headless
	if (headless) {
		if (typeof children === 'function') {
			return children({ isLoading, isError, data: chartData });
		}
		console.error('Arranger Charts Headless component needs a function as children to render.');
	}

	// theme value depending on data provided, and scoped to a single instance of a Charts
	const colorMap = useRef();

	// child component
	if (isLoading) {
		const { Loader } = globalTheme.components;
		return (
			<ChartContainer>
				<Loader />
			</ChartContainer>
		);
	} else if (isError) {
		const { ErrorData } = globalTheme.components;
		return (
			<ChartContainer>
				<ErrorData />
			</ChartContainer>
		);
	} else {
		const resolvedChartData = resolveData({ data: chartData, onDataLoad: theme.onDataLoad });

		if (isEmpty(resolvedChartData)) {
			const { EmptyData } = globalTheme.components;
			return (
				<ChartContainer>
					<EmptyData />
				</ChartContainer>
			);
		}

		if (!colorMap.current) {
			const keys = resolvedChartData.map((bucket) => bucket.key);
			colorMap.current = createColorMap({ keys, colors: globalTheme.colors });
		}

		// instance of a Chart theme values, eg. colorMap
		const instanceTheme = {
			colorMap: colorMap.current,
		};

		// resolve globalTheme with consumer provided theme and any instance dependant theming
		// TODO: Memo
		const chartTheme = merge(cloneDeep(globalTheme), theme, instanceTheme);

		return (
			<ChartContainer>
				<DisplayComponent
					// keep data pretty clean because we might manipulate in the charts
					// data vs config good separation anyway, can use functions that take data and resolve
					data={resolvedChartData}
					// add ChartProvider functionality into theme
					theme={chartTheme}
				/>
			</ChartContainer>
		);
	}
};
