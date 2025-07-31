import { Chart } from '#components/Chart';
import { ChartContainer } from '#components/helper/ChartContainer';

type BarChatData = { doc_count: number; key: string }[];
export const SunburstChart = ({
	fieldNames,
	mapping,
	handlers,
	components,
	theme,
	transformData,
}: {
	theme: any;
	fieldName: string;
	handlers?: { onClick: (config) => void };
	transformData?: (data: unknown) => BarChatData;
}) => {
	return (
		<ChartContainer>
			<Chart
				fieldNames={fieldNames}
				DisplayComponent={({ data, colorMap }) => {
					console.log('data', data, 'color map', colorMap);
					// this will re-render based on the internal chart fetching updates in "Chart" component
					return 'sunburst';
					return (
						<BarChartView
							data={data}
							theme={theme}
							colorMap={colorMap}
							onClick={handlers?.onClick}
						/>
					);
				}}
			/>
			sunburst
		</ChartContainer>
	);
};
