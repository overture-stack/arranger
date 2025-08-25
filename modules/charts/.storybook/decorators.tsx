import { ChartContainer } from '#components/ChartContainer';

export const chartContainerDecorator = (Story) => (
	<div style={{ height: '300px', width: '300px', display: 'flex' }}>
		<ChartContainer>
			<Story />
		</ChartContainer>
	</div>
);
