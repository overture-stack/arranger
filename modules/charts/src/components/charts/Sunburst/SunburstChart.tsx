import { css } from '@emotion/react';
import { useArrangerData } from '@overture-stack/arranger-components';
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';

import { ChartContainer } from '#components/ChartContainer';
import { ChartRenderer } from '#components/ChartRenderer';
import { useChartsContext } from '#components/Provider/Provider';
import { logger } from '#logger';
import { validateQueryProps } from '../validate';
import { createChartInput } from './dataTransform';
import { SunburstView } from './View';

/**
 * High-level sunburst chart component that handles validation, data pipeline, and rendering.
 * Creates hierarchical visualizations from multiple related fields using user-provided mapping.
 *
 * @param props - Sunburst chart configuration
 * @param props.mapping - Simple mapping object { childValue: 'parentCategory' }, {outer ring: inner ring}
 * @param props.handlers - Event handlers for chart interactions
 * @param props.theme - Arranger theme configuration
 * @returns JSX element with complete sunburst chart or null if field validation fails
 */
export const SunburstChart = ({
	fieldName,
	mapping,
	handlers,
	theme,
}: {
	fieldName: string;
	mapping: Record<string, string>;
	theme?: any;
	handlers?: { onClick: (config: any) => void };
}) => {
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

	const { isLoading, isError, data: gqlData } = getChartData(fieldName);

	// create mapping between api data and provided mapping
	const sunburstData = createChartInput(gqlData, mapping);

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError || !validationResult.success}
			isEmpty={isEmpty(sunburstData)}
			Chart={() => {
				return (
					<ChartContainer chartStyle={css({ margin: '16px 0' })}>
						<SunburstView
							data={sunburstData}
							handlers={handlers}
							theme={theme}
						/>
					</ChartContainer>
				);
			}}
		/>
	);
};
