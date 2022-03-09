import createPalette, { colours } from './palette';
import shape from './shape';

export default {
  colours,
  palette: createPalette(),
  shape,
};

export * as paletteItems from './palette';
