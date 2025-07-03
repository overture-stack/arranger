import path, { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^#(.+)$/,
				replacement: path.resolve('./src/$1'),
			},
		],
	},
	build: {
		minify: false, // useful for dev debug
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,
		lib: {
			entry: resolve(__dirname, './src/main.tsx'),
			name: 'charts',
			fileName: 'main',
			formats: ['es'],
		},
		rollupOptions: {
			external: [
				'react',
				'react/jsx-runtime',
				'react-dom',
				'@overture-stack/arranger-components',
				'@emotion/react',
				/@emotion\/.*/,
			],
			// build will hang in watch mode if not set
			maxParallelFileOps: 100,
		},
	},
	plugins: [
		// dts({
		//   rollupTypes: true,
		//   tsconfigPath: "./tsconfig.app.json",
		// }),
	],
});
