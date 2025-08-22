import { ReactNode } from 'react';

import { ChartDataContainer } from '#components/Chart';
import { ChartContainer as ChartViewContainer } from '#components/helper/ChartContainer';
import { logger } from '#logger';
import { defaultColors } from '#theme/colors';
import Color from 'color';
import { createSunburstTransform } from './dataTransform';
import { SunburstView } from './SunburstView';
import { useValidateInput } from './useValidateInput';

const colorMapResolver = ({ chartData }) => {
	const colorMap = new Map<string, string>();
	// used for "color wraparound" modulo
	let colorIndex = 0;

	chartData.inner.forEach(({ id, children }) => {
		const color = Color(defaultColors[colorIndex++ % defaultColors.length]);
		colorMap.set(id, color.alpha(0.5).hsl().string());
		children.forEach((child) => {
			colorMap.set(child, color.string());
		});
	});

	return colorMap;
};

/**
 * High-level sunburst chart component that handles validation, data pipeline, and rendering.
 * Creates hierarchical visualizations from multiple related fields using user-provided mapping.
 *
 * @param props - Sunburst chart configuration
 * @param props.fieldNames - Tuple of GraphQL Aggregation type field names for hierarchy [parentField, childField]
 * @param props.mapping - Simple mapping object { childValue: 'parentCategory' }
 * @param props.query - Optional query configuration
 * @param props.handlers - Event handlers for chart interactions
 * @param props.components - Custom components for fallback states
 * @param props.theme - Arranger theme configuration
 * @returns JSX element with complete sunburst chart or null if field validation fails
 */
export const SunburstChart = ({
	fieldName,
	mapping,
	handlers,
	components,
	theme,
}: {
	fieldName: string;
	mapping: Record<string, string>;
	theme?: any;
	handlers?: { onClick: (config: any) => void };
	components?: {
		Loader?: ReactNode;
		ErrorData?: ReactNode;
		EmptyData?: ReactNode;
	};
}) => {
	// validate and return chart aggregation config if successful
	const chartAggregation = useValidateInput({ fieldName });

	if (!chartAggregation) {
		logger.log('chart agg not supported, not valid fieldNames or unsupported typename', chartAggregation);
		return null;
	}

	const sunburstTransform = createSunburstTransform({ ...chartAggregation, mapping });

	return (
		<ChartDataContainer
			fieldNames={[fieldName]}
			chartConfig={chartAggregation}
			transformGQL={sunburstTransform}
			colorMapResolver={colorMapResolver}
			components={components}
			Chart={({ data, colorMap }) => {
				return (
					<ChartViewContainer>
						<SunburstView
							data={data}
							colorMap={colorMap}
						/>
					</ChartViewContainer>
				);
			}}
		/>
	);
};
