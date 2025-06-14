import { ChartContainer } from '#components/helper/ChartContainer';

export const chartContainerDecorator = (Story) => (
	<div style={{ height: '300px', width: '300px', display: 'flex' }}>
		<ChartContainer>
			<Story />
		</ChartContainer>
	</div>
);
