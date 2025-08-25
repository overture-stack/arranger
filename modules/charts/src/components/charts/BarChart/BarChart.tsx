import { ChartRenderer } from '#components/ChartRenderer';
import { ChartContainer as ChartViewContainer } from '#components/helper/ChartContainer';
import { useChartsContext } from '#components/Provider/Provider';
import { logger } from '#logger';
import { Ranges } from '#shared';
import { useArrangerData } from '@overture-stack/arranger-components';
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';
import { validateQueryProps } from '../validate';
import { BarChartView } from './BarChartView';

export interface NumericAggregationsOptions {
	ranges?: Ranges;
}

export interface BarChartProps {
	fieldName: string;
	ranges?: Ranges;
	theme: { sortByLabel?: string[]; nivo: any };
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
export const BarChart = ({ fieldName, ranges, handlers, theme }: BarChartProps) => {
	//
	const { extendedMapping } = useArrangerData();
	const { registerChart, deregisterChart, getChartData } = useChartsContext();

	const variables = { ranges };

	//
	const validationResult = useMemo(
		() => validateQueryProps({ fieldName, variables, extendedMapping }),
		[fieldName, variables, extendedMapping],
	);

	useEffect(() => {
		// validate and register
		const result = validateQueryProps({ fieldName, variables, extendedMapping });

		if (!validationResult.success) {
			logger.log(validationResult.message);
			return null;
		}

		registerChart(result.data);
		return () => deregisterChart(validationResult.data.fieldName);
	}, [fieldName, extendedMapping]);

	const { isLoading, isError, data: gqlData } = getChartData(fieldName);

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError || !validationResult.success}
			isEmpty={isEmpty(gqlData)}
			Chart={() => (
				<ChartViewContainer>
					<BarChartView
						data={gqlData}
						handlers={handlers}
						theme={theme}
					/>
				</ChartViewContainer>
			)}
		/>
	);
};
