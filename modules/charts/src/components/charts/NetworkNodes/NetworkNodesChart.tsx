import { isEmpty } from 'lodash';
import { useEffect, useRef } from 'react';

import { ChartContainer } from '#components/ChartContainer';
import { ChartRenderer } from '#components/ChartRenderer';
import { useChartsContext } from '#components/Provider/Provider';
import TopChartItemsCount from '../TopChartItemsCount.tsx';
import { NetworkNodeChartView } from './View.tsx';

interface SupportedNivo {
	axisLeft: { legend: any };
	axisBottom: { legend: any };
}

export interface NetworkNodesChartProps {
	maxBars?: number;

	theme: { sortAlphabetically?: boolean } & SupportedNivo;
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
 * @param props.isNetworkAggregation - If true, this chart will attempt a network aggregation query using the fieldName
 * @param props.components - Custom components for fallback states
 * @param props.theme - Chart config mostly for Nivo
 * @param props.maxBars = Required - determines how many bars to show.
 *   If maxBars is greater than the amount of available data, TopChartItemsCount will be hidden.
 * @returns JSX element with complete bar chart or null if field validation fails
 */
export const NetworkNodesChart = ({
	disableTopBarsCount = false,
	handlers,
	maxBars = Infinity,
	theme,
}: NetworkNodesChartProps) => {
	// ensure maxBars is provided
	if (!maxBars) {
		throw Error(`"maxBars" prop is required for NetworkNodes chart."`);
	}

	// get context
	const { getNetworkNodesData, requireNetworkSearch } = useChartsContext();

	// Set the charts context to require network search.
	useEffect(() => {
		requireNetworkSearch();
	}, []);

	// persist color map across re-mounting
	const colorMapRef = useRef<Map<string, string>>(null);

	const networkNodesResponse = getNetworkNodesData();
	const isLoading = networkNodesResponse.state === 'LOADING';
	const isError = networkNodesResponse.state === 'ERROR';
	const nodesData = networkNodesResponse.state === 'SUCCESS' ? networkNodesResponse.data : [];

	// redundant chart emptiness check for typescript
	const chartIsEmpty = isEmpty(nodesData);

	const totalNodes = nodesData.length;
	// show TopChartItemsCount when there's more data than what is being displayed.
	const showTopChartItemsCount = !disableTopBarsCount && totalNodes > maxBars;

	return (
		<ChartRenderer
			isLoading={isLoading}
			isError={isError}
			isEmpty={chartIsEmpty}
			Chart={() => (
				<ChartContainer>
					{showTopChartItemsCount && (
						<TopChartItemsCount
							items={maxBars}
							total={totalNodes}
						/>
					)}
					<NetworkNodeChartView
						data={nodesData}
						handlers={handlers}
						theme={theme}
						maxBars={maxBars}
						colorMapRef={colorMapRef}
					/>
				</ChartContainer>
			)}
		/>
	);
};
