// import path from 'node:path';
// import { fileURLToPath } from 'node:url';

// import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
// import { FlatCompat } from '@eslint/eslintrc';
// import jseslint from '@eslint/js';
// import * as emotionConfigs from '@emotion/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

import baseConfig from '../../eslint.config.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const compat = new FlatCompat({
// 	baseDirectory: __dirname,
// 	recommendedConfig: jseslint.configs.recommended,
// 	allConfig: jseslint.configs.all,
// });

const componentsConfigs = [
	// ...fixupConfigRules(
	// 	compat.extends(
	// 		'plugin:@emotion/recommended',
	// 	),
	// ),
	importPlugin.flatConfigs.react,
	reactPlugin.configs.flat.recommended,
	reactPlugin.configs.flat['jsx-runtime'],
	reactHooksPlugin.configs['recommended-latest'],
	jsxA11yPlugin.flatConfigs.recommended,
	{
		plugins: {
			// '@emotion': fixupPluginRules(emotionConfigs),
		},

		languageOptions: {
			globals: {
				...globals.browser,
				...globals.es2025,
				...globals.jest,
			},
		},

		rules: {
			// '@emotion/import-from-emotion': 'error',
			// '@emotion/no-vanilla': 'error',
			// '@emotion/pkg-renaming': 'error',
			// '@emotion/styled-import': 'error',

			'import/no-unresolved': ['error', { commonjs: true }],

			'react/jsx-filename-extension': [
				'error',
				{
					extensions: ['.jsx', '.tsx'],
				},
			],
			'react/no-unknown-property': [
				'error',
				{
					ignore: ['css'],
				},
			],
			'react/prop-types': 'off',
		},

		settings: {
			react: {
				version: 'detect',
			},
		},
	},
];

export default [...baseConfig, ...componentsConfigs];
