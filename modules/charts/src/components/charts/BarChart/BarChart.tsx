import { ChartDataContainer } from '#components/Chart';
import { ChartContainer as ChartViewContainer } from '#components/helper/ChartContainer';
import { logger } from '#logger';
import { createColorMap } from '#theme/colors';
import { BarChartView } from './BarChartView';
import { createBarChartTransform } from './dataTransform';
import { useValidateInput } from './useValidateInput';

export type NumericAggregationsOptions = {
	ranges?: any;
};
export type BarChartPropsQuery = {
	variables?: NumericAggregationsOptions;
	transformData?: (data: unknown) => any;
};

const colorMapResolver = ({ chartData }) => {
	const keys = chartData.map(({ key }: { key: string }) => key); // specfic chart color map code
	return createColorMap({ keys });
};

/**
 * High-level bar chart component that handles validation, data pipeline, and rendering.
 * Automatically validates field types and creates appropriate GraphQL queries.
 *
 * @param props - Bar chart configuration
 * @param props.fieldName - GraphQL field name to visualize
 * @param props.query - Optional query configuration for aggregations eg. NumericAggregations
 * @param props.handlers - Event handlers for chart interactions
 * @param props.components - Custom components for fallback states
 * @param props.theme - Arranger theme configuration
 * @returns JSX element with complete bar chart or null if field validation fails
 */
export const BarChart = ({
	fieldName,
	query = {},
	handlers,
	theme,
}: {
	theme: any;
	query?: BarChartPropsQuery;
	fieldName: string;
	handlers?: { onClick: (config: any) => void };
}) => {
	// validate and return chart aggregation config if successful
	const chartAggregation = useValidateInput({ fieldName, query });

	if (!chartAggregation) {
		logger.debug('chart agg not supported, not valid fieldnam or unspported typename', chartAggregation);
		return null;
	}

	const barChartTransform = createBarChartTransform(chartAggregation);

	return (
		<ChartDataContainer
			fieldNames={[fieldName]}
			chartConfig={chartAggregation}
			transformGQL={barChartTransform}
			colorMapResolver={colorMapResolver}
			Chart={({ data, colorMap }) => (
				<ChartViewContainer>
					<BarChartView
						data={data}
						colorMap={colorMap}
						theme={theme}
						onClick={handlers?.onClick}
					/>
				</ChartViewContainer>
			)}
		/>
	);
};
