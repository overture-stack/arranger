import { ResponsiveBar } from '@nivo/bar';

import { Chart } from '#components/Chart';
import { ArrangerChartProps } from '#theme/arranger';
import { arrangerToNivoBarChart } from '#theme/nivo/nivo';
import { css } from '@emotion/react';
import { useRef } from 'react';
import z from 'zod';

/**
 * Resolve to a Nivo Bar chart component
 */
export const BarChartView = ({ data, config }: ArrangerChartProps) => {
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

export const Barchart = ({ data, chart }: BarChartProps) => {
	const fieldName = data.fieldNames[0];
	const theme = {chart.xAxis.title.isVisible}
	return (
		<Chart
			fieldName={fieldName}
			theme={theme}
			DisplayComponent={(data) => <BarChartView data={data} config={config}/>}
		/>
	);
};

const dataActions = z.literal(['onClick']);

const AxisSchema = z.object({
	title: z.object({
		isVisible: z.boolean().default(true),
	}),
});

type t = z.infer<typeof dataActions>;
const BarChartPropsSchema = z.object({
	data: z.object({
		fieldNames: z.array(z.string()),
		onAction: z.custom<({ action, data }: { action: t; data: any }) => any>(),
		buckets: z.object({
			orderBy: z.custom<(param: string) => string>(),
		}),
	}),
	chart: z.object({
		onAction: z.custom<({ action, data }: { action: t; data: any }) => any>(),
		xAxis: AxisSchema,
		yAxis: AxisSchema,
	}),
});
export type BarChartProps = z.infer<typeof BarChartPropsSchema>;
