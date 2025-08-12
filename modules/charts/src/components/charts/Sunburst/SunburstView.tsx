import { css } from '@emotion/react';
import { ResponsiveSunburst } from '@nivo/sunburst';
import { useMemo } from 'react';

import { arrangerToNivoSunburst } from './nivo/config';

type SunburstViewProps = {
	data: any;
	theme: any;
	colorMap: any;
	onClick: any;
};

/**
 * Renders a responsive Nivo sunburst chart with Arranger theme integration.
 * Handles click interactions and applies consistent styling for hierarchical data.
 *
 * @param props - Sunburst chart view configuration
 * @param props.data - Transformed hierarchical chart data in Nivo format
 * @param props.theme - Arranger theme configuration
 * @param props.colorMap - Color mapping for consistent chart colors
 * @param props.onClick - Optional click handler for chart interactions
 * @returns JSX element with responsive sunburst chart
 */
export const SunburstView = ({ data, theme, colorMap, onClick }: SunburstViewProps) => {
	const resolvedTheme = useMemo(
		() => arrangerToNivoSunburst({ theme, colorMap, onClick }),
		[theme, colorMap, onClick],
	);

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveSunburst
				data={data}
				{...resolvedTheme}
			/>
		</div>
	);
};