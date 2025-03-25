import jseslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import fileExtensionInImportTs from 'eslint-plugin-file-extension-in-import-ts';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint, { configs as tseslintConfigs } from 'typescript-eslint';

/*
 * https://typescript-eslint.io/packages/typescript-eslint/#config
 * Method Description and instructions
 */
const eslintConfigs = tseslint.config(
	{
		// replacement for `.eslintignore`
		files: ['**/*.js', '**/*.ts'],
		ignores: ['**/node_modules', '**/dist/*'],
	},
	jseslint.configs.recommended,
	importPlugin.flatConfigs.recommended,
	tseslintConfigs.strict,
	tseslintConfigs.stylistic,
	importPlugin.flatConfigs.typescript,
	{
		languageOptions: {
			globals: {
				...globals.node,
			},

			ecmaVersion: 'latest',
			sourceType: 'module',

			parserOptions: {
				extraFileExtensions: ['.json'],
				project: ['./tsconfig.eslint.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},

		linterOptions: {
			reportUnusedDisableDirectives: 'error',
		},

		plugins: {
			'file-extension-in-import-ts': fileExtensionInImportTs,
			// 'sort-exports': exportSortPlugin,
		},

		rules: {
			'@typescript-eslint/consistent-type-definitions': ['warn', 'type'],
			'@typescript-eslint/consistent-type-exports': 'warn',
			'@typescript-eslint/consistent-type-imports': 'warn',
			'@typescript-eslint/no-empty-interface': [
				'warn',
				{
					allowSingleExtends: false,
				},
			],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-var-requires': 'warn',
			'@typescript-eslint/no-unused-expressions': [
				'warn',
				{
					allowShortCircuit: true,
					allowTernary: true,
				},
			],

			'file-extension-in-import-ts/file-extension-in-import-ts': [
				'error',
				'always',
				{
					extMapping: {
						'.jsx': '.js',
						'.ts': '.js',
						'.tsx': '.js',
					},
				},
			],

			'import/newline-after-import': 'warn',
			'import/order': [
				'warn',
				{
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
					distinctGroup: true,
					// NOTE: default groups order
					groups: ['builtin', 'external', 'internal', 'unknown', 'parent', 'sibling', 'index', 'object'],
					'newlines-between': 'always',
					pathGroups: [
						{
							pattern: '^#',
							group: 'internal',
							position: 'before',
						},
					],
					warnOnUnassignedImports: true,
				},
			],

			'prefer-const': ['warn'],

			// 'sort-exports/sort-exports': ['warn', { sortDir: 'asc', sortExportKindFirst: 'none' }],
		},

		settings: {
			'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
			'import/resolver': {
				node: {
					extensions: ['.js', '.jsx', '.ts', '.tsx'],
				},
				typescript: {
					alwaysTryTypes: true,
					extensionAlias: {
						'.js': ['.js', `.jsx`, '.ts', '.tsx'],
					},
				},
			},
			'import/internal-regex': '^#',
		},
	},
	eslintConfigPrettier,
);

// eslintConfigs.forEach((config) => {
// 	config?.rules &&
// 		Object.entries(config.rules).forEach(([rule, value]) => {
// 			rule.includes('import') && console.log('\n\n', rule, value);
// 		});
// });

export default eslintConfigs;
