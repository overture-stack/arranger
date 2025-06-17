import { cloneDeep, merge } from 'lodash';
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

// TODO: numeric or agg
const resolveData = ({ data }) => {
	return data.buckets;
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

	console.log('chart data', chartData);

	// headless
	if (headless) {
		if (typeof children === 'function') {
			return children({ isLoading, isError, data: chartData });
		}
		console.error('Arranger Charts Headless component needs a function as children to render.');
	}

	// instance level theme dependent on data provided
	const x = useRef();

	// child component
	if (isLoading) {
		const { Loader } = globalTheme.components;
		return <Loader />;
	} else if (isError) {
		const { ErrorData } = globalTheme.components;
		return <ErrorData />;
	} else if (chartData === undefined) {
		const { EmptyData } = globalTheme.components;
		return <EmptyData />;
	} else {
		// TODO: numeric or agg
		const resolvedChartData = resolveData({ data: chartData });

		if (!x.current) {
			const keys = resolvedChartData.map((bucket) => bucket.key);
			x.current = createColorMap({ keys, colors: globalTheme.colors });
		}

		const instanceTheme = {
			colorMap: x.current,
		};

		// resolve globalTheme with consumer provided theme
		// TODO: Memo
		const chartTheme = merge(cloneDeep(globalTheme), theme, instanceTheme);
		console.log('chart theme', chartTheme);

		return (
			<ChartContainer>
				<DisplayComponent
					// keep data pretty clean because we might manipulate in the charts
					// data vs config good seperation anyway, can use functions that take data and resolve
					data={resolvedChartData}
					// add ChartProvider functionality into theme
					theme={chartTheme}
				/>
			</ChartContainer>
		);
	}
};
