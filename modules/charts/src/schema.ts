import z from 'zod';

// handlers for data events eg. onLoad, onError
const dataActions = z.literal(['onLoad']);
type DataActions = z.infer<typeof dataActions>;

// handlers for chart events eg. onMouseEnter, onLabelClick
const chartActions = z.literal(['onClick']);
type ChartActions = z.infer<typeof chartActions>;

const AxisSchema = z.object({
	title: z.object({
		isVisible: z.boolean().default(true),
	}),
});

const ChartPropsSchema = z.object({
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

export type ChartProps = z.infer<typeof ChartPropsSchema>;
