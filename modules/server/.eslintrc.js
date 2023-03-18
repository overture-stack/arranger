module.exports = {
	parserOptions: {
		project: ['./tsconfig.json', '../../tsconfig.eslint.json'],
	},
	settings: {
		'import/resolver': {
			typescript: {
				project: './tsconfig.json',
			},
		},
	},
};
