import type { Meta, StoryObj } from '@storybook/react-vite';
import { action } from 'storybook/actions';

import { chartContainerDecorator } from '../../../../.storybook/decorators';
import { BarChartView } from './Barchart';

const theme = {
	onClick: (data) => {
		console.log('bar chart click', data);
		action('bar click');
	},
	resolveColor: () => 'navy',
};

const meta = {
	component: BarChartView,
	decorators: [chartContainerDecorator],
	args: {
		theme,
	},
} satisfies Meta<typeof BarChartView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		data: {
			bucket_count: 3,

			buckets: [
				{
					doc_count: 224,
					key: 'Male',
				},
				{
					doc_count: 101,
					key: 'Female',
				},
				{
					doc_count: 37,
					key: 'Other',
				},
			],
		},
	},
};
