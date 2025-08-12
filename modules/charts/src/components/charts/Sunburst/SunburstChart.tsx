import { ReactNode } from 'react';

import { ChartDataContainer } from '#components/Chart';
import { logger } from '#logger';
import { createColorMap } from '#theme/colors';
import { createSunburstTransform } from './dataTransform';
import { useValidateInput } from './useValidateInput';

const colorMapResolver = ({ chartData }) => {
	// Extract all unique IDs from hierarchical data for consistent coloring
	const extractIds = (nodes) => {
		const ids = [];
		nodes.forEach((node) => {
			ids.push(node.id);
			if (node.children) {
				ids.push(...extractIds(node.children));
			}
		});
		return ids;
	};

	const keys = extractIds(chartData);
	return createColorMap({ keys });
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
	fieldNames,
	mapping,
	handlers,
	components,
	theme,
}: {
	fieldNames: [string, string]; // [parentField, childField]
	mapping: Record<string, string>; // { childValue: 'parentCategory' }
	theme?: any;
	handlers?: { onClick: (config: any) => void };
	components?: {
		Loader?: ReactNode;
		ErrorData?: ReactNode;
		EmptyData?: ReactNode;
	};
}) => {
	// validate and return chart aggregation config if successful
	const chartAggregation = useValidateInput({ fieldNames });
	console.log('CHART AGG', chartAggregation);

	if (!chartAggregation) {
		logger.log('chart agg not supported, not valid fieldNames or unsupported typename', chartAggregation);
		return null;
	}

	const sunburstTransform = createSunburstTransform({ ...chartAggregation, mapping });

	return (
		<ChartDataContainer
			fieldNames={fieldNames}
			chartConfig={chartAggregation}
			transformGQL={(x) => x}
			colorMapResolver={() => {}}
			components={components}
			Chart={({ data, colorMap }) => {
				console.log('sunburst', data, colorMap);
				return <div>sunburst</div>;
			}}
		/>
	);
};
