import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';

import { useColorMap } from '#hooks/useColorMap';
import { BarChartProps } from './BarChart';
import { arrangerToNivoBarChart } from './nivo/config';

interface BarChartViewProps {
	data: any;
	handlers: BarChartProps['handlers'];
	theme: BarChartProps['theme'];
	maxBars: BarChartProps['maxBars'];
	colorMapRef: React.RefObject<Map<string, string>>;
}

/**
 * Creates a chart color map for consistent colors across charts
 **/
const colorMapResolver = ({ chartData, savedMap, colors }) => {
	// intialize to session stored color map if exists
	const colorMap = new Map<string, string>(savedMap);

	// used for "color wraparound" modulo
	// initialize to size of current items to avoid same colour hex collisions
	let colorIndex = colorMap.size;

	chartData.forEach(({ key }) => {
		const assignedColor = colors[colorIndex++ % colors.length];
		if (!colorMap.has(key)) {
			colorMap.set(key, assignedColor);
		}
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
 * @param props.maxBars - Max number of bars to show
 * @returns JSX element with responsive bar chart
 */
export const BarChartView = ({ data, handlers, theme, maxBars, colorMapRef, fieldName }: BarChartViewProps) => {
	// persistent color map
	// ensure to create from full data available before slicing visible data
	const { colorMap } = useColorMap({ fieldName, colorMapRef, chartData: data, resolver: colorMapResolver });

	/**
	 * TODO: improve "chart view" config/interface
	 * right now it's a bit of a catch all config function
	 * handlers currently only support onClick
	 */
	const resolvedTheme = useMemo(
		() => arrangerToNivoBarChart({ theme, colorMap, onClick: handlers?.onClick }),
		[theme, colorMap, handlers],
	);

	// 1) custom sort order or ascending (from axis)
	// 2) limit by maxRows
	// 3) reverse order for display
	const barData = theme.sortByKey
		? theme.sortByKey
				.map((label) => data.find((bar) => bar.key === label))
				.filter(Boolean)
				.slice(0, maxBars)
		: data
				.toSorted((a, b) => b.value - a.value)
				.slice(0, maxBars)
				.reverse();

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveBar
				data={barData}
				{...resolvedTheme}
			/>
		</div>
	);
};
