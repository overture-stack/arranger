import { useArrangerData } from '@overture-stack/arranger-components';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Ranges } from '#arranger';
import { ChartContainer } from '#components/ChartContainer';
import { ChartRenderer } from '#components/ChartRenderer';
import { useChartsContext } from '#components/Provider/Provider';
import { logger } from '#logger';
import TopChartItemsCount from '../TopChartItemsCount.tsx';
import { validateQueryProps } from '../validate';
import { BarChartView } from './View';

export interface NumericAggregationsOptions {
	ranges?: Ranges;
}

export interface SupportedNivo {
	axisLeft: { legend: any };
	axisBottom: { legend: any };
}

export interface BarChartProps {
	fieldName: string;
	maxBars: number;
	ranges?: Ranges;
	theme: { sortByKey?: string[]; axisBottom: { customTickValueSize?: number } } & SupportedNivo;
	handlers?: { onClick: (config: any) => void };
	disableTopBarsCount?: boolean;
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
 * @param props.maxBars = Required - determines how many bars to show.
 *   If maxBars is greater than the amount of available data, TopChartItemsCount will be hidden.
 * @returns JSX element with complete bar chart or null if field validation fails
 */
export const BarChart = ({
	disableTopBarsCount = false,
	fieldName,
	handlers,
	maxBars,
	ranges,
	theme,
}: BarChartProps) => {
	// ensure maxBars is provided
	if (!maxBars) {
		throw Error(`"maxBars" prop is required for ${fieldName} chart."`);
	}

	// get context
	const { extendedMapping } = useArrangerData();
	const { registerChart, deregisterChart, getChartData } = useChartsContext();

	const variables = { ranges };

	// validate
	const validationResult = useMemo(
		() => validateQueryProps({ fieldName, variables, extendedMapping }),
		[fieldName, variables, extendedMapping],
	);

	useEffect(() => {
		// validate and register
		const result = validateQueryProps({
			extendedMapping,
			fieldName,
			variables,
		});

		if (!validationResult.success) {
			logger.log(validationResult.message);
			return null;
		}

		registerChart(result.data);
		return () => deregisterChart(validationResult.data.fieldName);
	}, [fieldName, extendedMapping]);

	// persist color map across re-mounting
	const colorMapRef = useRef();

	const { isLoading, isError, data: gqlData } = getChartData(fieldName);

	// redundant chart emptiness check for typescript
	const chartIsEmpty = isEmpty(gqlData);

	const totalItems = gqlData?.length || 0;
	// show TopChartItemsCount when there's more data than what is being displayed.
	const showTopChartItemsCount = !disableTopBarsCount && totalItems > maxBars;

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError || !validationResult.success}
			isEmpty={chartIsEmpty}
			Chart={() => (
				<ChartContainer>
					{showTopChartItemsCount && (
						<TopChartItemsCount
							items={maxBars}
							total={totalItems}
						/>
					)}
					<BarChartView
						data={gqlData}
						handlers={handlers}
						theme={theme}
						maxBars={maxBars}
						colorMapRef={colorMapRef}
						fieldName={fieldName}
					/>
				</ChartContainer>
			)}
		/>
	);
};
