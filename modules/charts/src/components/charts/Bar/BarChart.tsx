import { useArrangerData } from '@overture-stack/arranger-components';
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';

import { Ranges } from '#arranger';
import { ChartRenderer } from '#components/ChartRenderer';
import { useChartsContext } from '#components/Provider/Provider';
import { logger } from '#logger';
import { validateQueryProps } from '../validate';
import { BarChartView } from './View';

export interface NumericAggregationsOptions {
	ranges?: Ranges;
}

export interface BarChartProps {
	fieldName: string;
	ranges?: Ranges;
	theme: { sortByKey?: string[]; nivo: any };
	handlers?: { onClick: (config: any) => void };
}

/**
 * High-level bar chart component that handles validation, data pipeline, and rendering.
 * Automatically validates field types and creates appropriate GraphQL queries.
 *
 * @param props - Bar chart configuration
 * @param props.fieldName - GraphQL field name to visualize
 * @param props.handlers - Event handlers for chart interactions
 * @param props.components - Custom components for fallback states
 * @param props.theme - Chart config mostly for Nivo
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
				<BarChartView
					data={gqlData}
					handlers={handlers}
					theme={theme}
				/>
			)}
		/>
	);
};
