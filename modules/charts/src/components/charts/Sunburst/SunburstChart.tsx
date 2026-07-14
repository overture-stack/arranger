import { useArrangerData } from '@overture-stack/arranger-components';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { ChartContainer } from '#components/ChartContainer';
import { ChartRenderer } from '#components/ChartRenderer';
import { useChartsContext } from '#components/Provider/Provider';
import { logger } from '#logger';
import { aggregationsTypenames } from '../../../arranger';
import { success } from '../../../utils/result';
import { validateQueryProps } from '../validate';
import { ChartInput, createSunburstSegments, SunburstMappingFn } from './dataTransform';
import { SunburstView } from './View';

/**
 * High-level sunburst chart component that handles validation, data pipeline, and rendering.
 * Creates hierarchical visualizations from multiple related fields using user-provided mapping.
 *
 * @param props - Sunburst chart configuration
 * @param props.fieldName - Name of the field that this chart will show aggregation data for
 * @param props.isNetworkAggregation - If true, this chart will use a network aggregation query as its data source
 * @param props.mapper - Mapper function to map outer rings to inner rings
 * @param props.handlers - Event handlers for chart interactions
 * @param props.maxSegments - Max number of segments shown
 * @param props.theme - Arranger theme configuration
 * @returns JSX element with complete sunburst chart or null if field validation fails
 */
export const SunburstChart = ({
	fieldName,
	isNetworkAggregation = false,
	mapper,
	handlers,
	maxSegments,
	theme,
}: {
	fieldName: string;
	isNetworkAggregation?: boolean;
	mapper: SunburstMappingFn;
	maxSegments: ChartInput['maxSegments'];
	theme?: any;
	handlers?: { onClick: (config: any) => void };
}) => {
	// ensure maxSegments is provided
	if (!maxSegments) {
		throw Error(`"maxSegments" prop is required for ${fieldName} chart."`);
	}

	if (!mapper) {
		throw Error(`"mapper" prop is required for ${fieldName} chart."`);
	}

	const { extendedMapping } = useArrangerData();
	const { registerChart, deregisterChart, getChartData, getNetworkChartData } = useChartsContext();

	// validate the requested fields and variables using the extended mapping
	const validationResult = useMemo(
		() =>
			isNetworkAggregation
				? // TODO: Validate for network fields and determine gqlType (no extended mapping guarantee atm for network aggregations)
					success({ fieldName, gqlTypename: aggregationsTypenames.Aggregations, isNetworkAggregation: true })
				: validateQueryProps({ fieldName, variables: {}, extendedMapping }),
		[isNetworkAggregation, fieldName, extendedMapping],
	);

	useEffect(() => {
		if (!validationResult.success) {
			logger.log(validationResult.message);
			return undefined;
		}

		registerChart(validationResult.data);
		return () => deregisterChart({ fieldName: validationResult.data.fieldName, isNetworkAggregation });
	}, [fieldName, extendedMapping]);

	const colorMapRef = useRef<Map<string, string>>(null);

	const chartData = isNetworkAggregation ? getNetworkChartData(fieldName) : getChartData(fieldName);
	const isLoading = chartData.state === 'LOADING';
	const isError = chartData.state === 'ERROR';
	const gqlData = chartData.state === 'SUCCESS' ? chartData.data : null;

	// create mapping between api data and provided mapping
	const sunburstData = createSunburstSegments({ data: gqlData, mapper, maxSegments });

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError || !validationResult.success}
			isEmpty={isEmpty(sunburstData)}
			Chart={() => {
				return (
					<ChartContainer>
						<SunburstView
							data={sunburstData}
							handlers={handlers}
							theme={theme}
							colorMapRef={colorMapRef}
							maxSegments={maxSegments}
							fieldName={fieldName}
						/>
					</ChartContainer>
				);
			}}
		/>
	);
};
