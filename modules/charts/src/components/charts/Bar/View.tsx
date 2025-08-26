import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';

import { useThemeContext } from '#components/ChartsThemeProvider';
import { useColorMap } from '#hooks/useColorMap';
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

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveBar
				data={sortedData}
				{...resolvedTheme}
			/>
		</div>
	);
};
