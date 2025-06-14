import { ReactNode, useEffect } from 'react';

import { ChartContainer } from '#components/helper/ChartContainer';
import { useChartsContext } from '#components/Provider/Provider';
import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';

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

	const { registerChart, deregisterChart, getChartData, resolveColor } = useChartsContext();

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

	// child component
	if (isLoading) {
		return <div>Loading</div>;
	} else if (isError) {
		return <div>Error</div>;
	} else if (chartData === undefined) {
		return <div>no data</div>;
	} else {
		//	const resolveColorFn = wrapWithFieldName;
		// wrap all theme, instead of passing more props around, keep other interfaces well defined

		return (
			<ChartContainer>
				<DisplayComponent
					// keep data pretty clean because we might manipulate in the charts
					// data vs config good seperation anyway, can use functions that take data and resolve
					data={chartData}
					// add ChartProvider functionality into theme
					theme={{ ...theme, resolveColor: (args) => resolveColor({ fieldName, ...args }) }}
				/>
			</ChartContainer>
		);
	}
};
