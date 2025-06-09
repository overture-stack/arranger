import { defineConfig } from 'vite';
import path, { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
	resolve: {
		alias: {
			'#': path.resolve(__dirname, './src/*'),
		},
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,
		lib: {
			entry: resolve(__dirname, 'src/main.tsx'),
			name: 'charts',
			fileName: 'main',
			formats: ['es'],
		},
		rollupOptions: {
			external: ['react', 'react/jsx-runtime', '@overture-stack/arranger-components'],
		},
	},
	plugins: [
		// dts({
		//   rollupTypes: true,
		//   tsconfigPath: "./tsconfig.app.json",
		// }),
	],
});
