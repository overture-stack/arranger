import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';

import { useColorMap } from '#hooks/useColorMap';
import { createColorMap } from '#theme/colors';
import { BarChartProps } from './BarChart';
import { arrangerToNivoBarChart } from './nivo/config';

interface BarChartViewProps {
	data: any;
	handlers: BarChartProps['handlers'];
	theme: BarChartProps['theme'];
	colorMap: any;
}

const colorMapResolver = ({ chartData }) => {
	const keys = chartData.map(({ key }: { key: string }) => key); // specfic chart color map code
	return createColorMap({ keys });
};

/**
 * Renders a responsive Nivo bar chart with Arranger theme integration.
 * Handles click interactions and applies consistent styling.
 *
 * @param props - Bar chart view configuration
 * @param props.data - Transformed chart data in Nivo format
 * @param props.theme - Arranger theme configuration
 * @param props.colorMap - Color mapping for consistent chart colors
 * @param props.onClick - Optional click handler for chart interactions
 * @returns JSX element with responsive bar chart
 */
export const BarChartView = ({ data, handlers, theme }: BarChartViewProps) => {
	const sortedData = theme.sortByLabel
		? theme.sortByLabel.map((label) => data.find((bar) => bar.key === label)).filter(Boolean)
		: data;

	// persistent color map
	const { colorMap } = useColorMap({ chartData: sortedData, resolver: colorMapResolver });

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
