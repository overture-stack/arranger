const babelConfigs = (api) => {
	const isTestEnv = api.env('test');

	return {
		...(isTestEnv || {
			ignore: [
				'**/*.test.js',
			],
		}),
		presets: [
			[
				'@babel/preset-env',
				{
					// modules: false,
					targets: {
						// esmodules: true,
						node: 'current',
						// 	browsers: '> 0.25%, not dead',
					},
				},
			],
			[
				'@babel/preset-react',
				{
					development: process.env.BABEL_ENV === 'development',
					runtime: 'automatic',
					importSource: '@emotion/react',
				},
			],
			[
				'@babel/preset-typescript',
				// {
				// 	rewriteImportExtensions: true,
				// },
			],
		],
		plugins: [
			[
				'module-resolver',
				{
					alias: {
						'^#public': './public',
						'^#(.+)': './src/\\1', // keep this as last alias, to allow others first
						'^lodash-es$': 'lodash', // TODO flip this around when we're on ESM
					},
					cwd: 'packagejson',
					extensions: ['.js', '.jsx', '.d.ts', '.ts', '.tsx'],
					root: ['./src'],
					stripExtensions: ['.js', '.jsx', '.d.ts', '.ts', '.tsx'],
				},
			],
			'@emotion/babel-plugin',
			'@babel/plugin-transform-destructuring',
			// '@babel/plugin-transform-runtime',
			// '@babel/plugin-transform-object-rest-spread',
			// '@babel/plugin-proposal-export-namespace-from',
			// '@babel/plugin-proposal-optional-chaining',
			// '@babel/plugin-proposal-class-properties',
		],
		sourceMaps: 'inline',
		// targets: {
		// 	esmodules: true,
		// }
	};
};

export default babelConfigs;
