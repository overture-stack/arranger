import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
	core: {
		builder: {
			name: '@storybook/builder-vite',
			options: {
				viteConfigPath: './vite.config.ts',
			},
		},
	},
	async viteFinal(config, options) {
		config.define = { 'process.env': process.env };
		config.esbuild = {
			...config.esbuild,
			jsx: 'automatic',
		};
		return config;
	},
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
	addons: ['@storybook/addon-onboarding', '@storybook/addon-docs'],
	staticDirs: ['../public'],
	framework: {
		name: '@storybook/react-vite',
		options: {},
	},
};
export default config;
