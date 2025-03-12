module.exports = {
	env: {
		browser: true,
	},
	extends: [
		'plugin:jsx-a11y/strict',
		'plugin:react/recommended',
		'plugin:react/jsx-runtime',
		'plugin:react-hooks/recommended',
	],
	parserOptions: {
		ecmaFeatures: {
			jsx: true,
		},
		project: ['./tsconfig.json', '../../tsconfig.eslint.json'],
	},
	plugins: ['@emotion', 'react', 'jsx-a11y'],
	rules: {
		'@emotion/import-from-emotion': 'error',
		'@emotion/no-vanilla': 'error',
		'@emotion/pkg-renaming': 'error',
		'@emotion/styled-import': 'error',
		'jsx-a11y/href-no-hash': 'off',
		'react/no-unknown-property': ['error', { ignore: ['css'] }],
		'react/prop-types': 'off',
	},
	settings: {
		'import/resolver': {
			'babel-module': { allowExistingDirectories: true },
		},
		react: {
			version: 'detect',
		},
	},
};
