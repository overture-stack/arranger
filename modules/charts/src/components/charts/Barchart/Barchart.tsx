import { ResponsiveBar } from '@nivo/bar';

import { Chart } from '#components/Chart';
import { ArrangerChartProps, ArrangerChartTheme } from '#theme/arranger';
import { arrangerToNivoBarChart } from '#theme/nivo/nivo';
import { css } from '@emotion/react';
import { useRef } from 'react';
import z from 'zod';

/**
 * Resolve to a Nivo Bar chart component
 */
export const BarchartComp = ({ data, theme }: ArrangerChartProps) => {
	// create div ref for toggling css style
	const wrapperRef = useRef(null);
	const resolvedTheme = arrangerToNivoBarChart({ data, theme, wrapperRef });

	return (
		<div
			css={css({ width: '100%', height: '100%' })}
			ref={wrapperRef}
		>
			<ResponsiveBar
				data={data}
				{...resolvedTheme}
			/>
		</div>
	);
};

export const Barchart = ({ fieldName, theme }: { fieldName: string; theme: ArrangerChartTheme }) => {
	return (
		<Chart
			chartType="barchart"
			fieldName={fieldName}
			theme={theme}
			DisplayComponent={BarchartComp}
		/>
	);
};

export const BarChartPropsSchema = z.object({
	fieldName: z.string(),
	theme: z.record(z.string(), z.any()),
	chart: z.object({
		showLegends: z.boolean().default(true),
	}),
});
export type BarChartProps = z.infer<typeof BarChartPropsSchema>;
