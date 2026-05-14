/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
	printWidth: 120,
	semi: true,
	singleAttributePerLine: true,
	singleQuote: true,
	tabWidth: 4,
	trailingComma: 'all',
	useTabs: true,
	plugins: ['prettier-plugin-organize-imports'],
};

export default config;
