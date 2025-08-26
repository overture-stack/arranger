import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useThemeContext } from '#components/ChartsThemeProvider';
import { useColorMap } from '#hooks/useColorMap';
import { css } from '@emotion/react';
import { Bar } from '@nivo/bar';
import { BarChartProps } from './BarChart';
import { arrangerToNivoBarChart } from './nivo/config';

interface BarChartViewProps {
	data: any;
	handlers: BarChartProps['handlers'];
	theme: BarChartProps['theme'];
}

/**
 * Creates a chart color map for consistent colors across charts
 * Uses closure-based state, not a React hook
 **/
const colorMapResolver = ({ chartData, colors }) => {
	const colorMap = new Map<string, string>();

	// used for "color wraparound" modulo
	let colorIndex = 0;

	chartData.forEach(({ key }) => {
		const assignedColor = colors[colorIndex++ % colors.length];
		colorMap.set(key, assignedColor);
	});

	return colorMap;
};

/**
 * Renders a responsive Nivo bar chart with Arranger theme integration.
 * Handles click interactions and applies consistent styling.
 *
 * @param props - Bar chart view configuration
 * @param props.data - Transformed chart data in Nivo format
 * @param props.handlers -
 * @param props.theme - Arranger theme configuration
 * @returns JSX element with responsive bar chart
 */
export const BarChartView = ({ data, handlers, theme }: BarChartViewProps) => {
	// sort data
	const sortedData = theme.sortByKey
		? theme.sortByKey.map((label) => data.find((bar) => bar.key === label)).filter(Boolean)
		: data;

	// persistent color map
	const { colors } = useThemeContext();
	const { colorMap } = useColorMap({ chartData: sortedData, resolver: colorMapResolver, colors });

	/**
	 * TODO: improve "chart view" config/interface
	 * right now it's a bit of a catch all config function
	 * handlers currently only support onClick
	 */
	const resolvedTheme = useMemo(
		() => arrangerToNivoBarChart({ theme, colorMap, onClick: handlers?.onClick }),
		[theme, colorMap, handlers],
	);

	/**
	 * we have to explicitly tell Nivo charts it's dimensions
	 * it's <Responsive... charts don't work for dynamic data lengths, ie. it'll scrunch up the chart
	 *
	 * Get dimensions of parent container from the consumer app.
	 * We need to compare its size versus the "native chart" size.
	 * Uses a rough estimate of pixels and factors in some cosmetic space to account for axes, margins etc
	 *
	 * TODO: also do width, for vertical barcharts and resize
	 */
	const barRef = useRef();
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [initialContainerHeight, setInitialContainerHeight] = useState(0);

	// rough estimates
	const barHeight = 26;
	const additionalSpace = 20;
	const totalBarSize = barHeight * sortedData.length;
	// default to full height of container for small data sets
	const totalNativeHeight = totalBarSize + additionalSpace;
	// Use initial container height as minimum, not current height
	const calculatedHeight = Math.max(totalNativeHeight, initialContainerHeight);

	useLayoutEffect(() => {
		if (barRef.current) {
			// get height of consumer container only once for min chart height
			if (initialContainerHeight === 0) {
				const height = barRef.current.offsetHeight;
				setInitialContainerHeight(height);
			}

			// update width
			setDimensions((prev) => {
				const newWidth = barRef.current.offsetWidth;

				if (prev.width !== newWidth) {
					return { ...prev, width: newWidth };
				}
				return prev;
			});
		}
	});

	return (
		<div
			ref={barRef}
			css={css({ flex: 1, overflow: 'scroll' })}
		>
			<Bar
				data={sortedData}
				{...resolvedTheme}
				height={calculatedHeight}
				width={dimensions.width}
			/>
		</div>
	);
};
