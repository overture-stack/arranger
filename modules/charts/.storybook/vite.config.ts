import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	define: {
		'process.env': process.env,
	},
	esbuild: {
		jsx: 'automatic',
	},
	plugins: [
		react({
			jsxRuntime: 'automatic',
		}),
	],
});
