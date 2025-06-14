import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
	decorators: [
		// 👇 Defining the decorator in the preview file applies it to all stories
		(Story, { parameters }) => {
			return <Story />;
		},
	],
};

export default preview;
