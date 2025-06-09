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
			external: ['react', 'react/jsx-runtime', '@overture-stack/arranger-components'],
		},
	},
	plugins: [
		,// dts({
		//   rollupTypes: true,
		//   tsconfigPath: "./tsconfig.app.json",
		// }),
	],
});
