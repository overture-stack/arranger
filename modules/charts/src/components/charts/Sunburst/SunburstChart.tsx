import { useArrangerData } from '@overture-stack/arranger-components';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { ChartContainer } from '#components/ChartContainer';
import { ChartRenderer } from '#components/ChartRenderer';
import { useChartsContext } from '#components/Provider/Provider';
import { logger } from '#logger';
import { validateQueryProps } from '../validate';
import { ChartInput, createSunburstSegments, SunburstMappingFn } from './dataTransform';
import { SunburstView } from './View';

/**
 * High-level sunburst chart component that handles validation, data pipeline, and rendering.
 * Creates hierarchical visualizations from multiple related fields using user-provided mapping.
 *
 * @param props - Sunburst chart configuration
 * @param props.mapper - Mapper function to map outer rings to inner rings, specific to broad
 * @param props.handlers - Event handlers for chart interactions
 * @param props.maxSegments - Max number of segments shown
 * @param props.theme - Arranger theme configuration
 * @returns JSX element with complete sunburst chart or null if field validation fails
 */
export const SunburstChart = ({
	fieldName,
	mapper,
	handlers,
	maxSegments,
	theme,
}: {
	fieldName: string;
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
	const { registerChart, deregisterChart, getChartData } = useChartsContext();

	const validationResult = useMemo(
		() => validateQueryProps({ fieldName, extendedMapping }),
		[fieldName, extendedMapping],
	);

	useEffect(() => {
		if (!validationResult.success) {
			logger.log(validationResult.message);
			return null;
		}

		registerChart(validationResult.data);
		return () => deregisterChart(validationResult.data.fieldName);
	}, [fieldName, extendedMapping]);

	const colorMapRef = useRef();

	const { isLoading, isError, data: gqlData } = getChartData(fieldName);

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError || !validationResult.success}
			isEmpty={isEmpty(gqlData)}
			Chart={() => {
				// create mapping between api data and provided mapping
				const sunburst = createSunburstSegments({ data: gqlData, mapper, maxSegments });

				return (
					<ChartContainer>
						<SunburstView
							data={sunburst}
							handlers={handlers}
							theme={theme}
							colorMapRef={colorMapRef}
						/>
					</ChartContainer>
				);
			}}
		/>
	);
};
