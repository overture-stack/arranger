import { defineConfig } from 'tsup';

export default defineConfig({
	clean: true,
	dts: true,
	entry: [
		'src/index.ts',
		'src/configs/index.ts',
		'src/configs/constants.ts',
		'src/elastic/index.ts',
		'src/elastic/constants.ts',
		'src/tools/index.ts',
	],
	format: ['esm', 'cjs'],
	outDir: 'dist',
	sourcemap: true,
});
