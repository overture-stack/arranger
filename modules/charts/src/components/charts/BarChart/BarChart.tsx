import { ChartRenderer } from '#components/ChartRenderer';
import { ChartContainer as ChartViewContainer } from '#components/helper/ChartContainer';
import { useChartsContext } from '#components/Provider/Provider';
import { logger } from '#logger';
import { useArrangerData } from '@overture-stack/arranger-components';
import { isEmpty } from 'lodash';
import { useEffect } from 'react';
import { BarChartView } from './BarChartView';
import { validateQueryProps } from './validate';

export interface NumericAggregationsOptions {
	ranges?: any;
}

export interface BarChartProps {
	fieldName: string;
	theme: any;
	handlers?: { onClick: (config: any) => void };
}

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
export const BarChart = ({ fieldName, handlers, theme }: BarChartProps) => {
	//
	const { extendedMapping } = useArrangerData();
	const { registerChart, deregisterChart, getChartData } = useChartsContext();

	// gql variables
	const variables = {};

	useEffect(() => {
		// validate and register
		const result = validateQueryProps({ fieldName, variables, extendedMapping });

		if (!result.success) {
			logger.log(result.message);
			return null;
		}

		registerChart(result.data);
		return () => deregisterChart(result.data.fieldName);
	}, [fieldName, extendedMapping]);

	const { isLoading, isError, data: gqlData } = getChartData(fieldName);

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError}
			isEmpty={isEmpty(gqlData)}
			Chart={() => (
				<ChartViewContainer>
					<BarChartView
						data={gqlData}
						handlers={handlers}
					/>
				</ChartViewContainer>
			)}
		/>
	);
};
