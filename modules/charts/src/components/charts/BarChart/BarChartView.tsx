import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';

import { useColorMap } from '#hooks/useColorMap';
import { createColorMap } from '#theme/colors';
import { arrangerToNivoBarChart } from './nivo/config';

type BarChartViewProps = {
	data: any;
	theme: any;
	colorMap: any;
	onClick: any;
};

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
export const BarChartView = ({ data, theme, onClick }: BarChartViewProps) => {
	// persistent color map
	const { colorMap } = useColorMap({ chartData: data, resolver: colorMapResolver });

	//return <pre>{JSON.stringify(data)}</pre>;
	const resolvedTheme = useMemo(
		() => arrangerToNivoBarChart({ theme, colorMap, onClick }),
		[theme, colorMap, onClick],
	);

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveBar
				data={data}
				{...resolvedTheme}
			/>
		</div>
	);
};
