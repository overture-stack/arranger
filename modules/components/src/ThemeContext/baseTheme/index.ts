import createPalette, { colors } from './palette/index.js';
import shape from './shape.js';

export default {
	colors,
	palette: createPalette(),
	shape,
};

export * as paletteItems from './palette/index.js';
