import baseConfig from '../../eslint.config.js';

const serverConfigs = [
	...baseConfig,
	{
		// languageOptions: {
		// 	parserOptions: {
		// 		// project: ['./tsconfig.json'],
		// 		// tsconfigRootDir: import.meta.dirname,
		// 	},
		// },
	},
];

export default serverConfigs;
