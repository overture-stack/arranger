import z from 'zod';

const dataActions = z.literal(['onLoad']);
const chartActions = z.literal(['onClick']);

type DataActions = z.infer<typeof dataActions>;
type ChartActions = z.infer<typeof chartActions>;

const AxisSchema = z.object({
	title: z.object({
		isVisible: z.boolean().default(true),
	}),
});

const BarChartPropsSchema = z.object({
	data: z.object({
		fieldNames: z.array(z.string()),
		onAction: z.custom<({ action, data }: { action: DataActions; data: any }) => any>(),
		buckets: z.object({
			orderBy: z.custom<(param: any) => any>(),
		}),
	}),
	chart: z.object({
		onAction: z.custom<({ action, data }: { action: ChartActions; data: any }) => any>(),
		xAxis: AxisSchema,
		yAxis: AxisSchema,
	}),
});

export type BarChartProps = z.infer<typeof BarChartPropsSchema>;
