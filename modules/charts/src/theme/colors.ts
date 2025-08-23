export const defaultColors = [
	// https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic
	'#a6cee3',
	'#1f78b4',
	'#b2df8a',
	'#33a02c',
	'#fb9a99',
	'#e31a1c',
	'#fdbf6f',
	'#ff7f00',
	'#cab2d6',
	'#6a3d9a',
	'#ffff99',
	'#b15928',
];

/**
 * Creates a chart color map for consistent colors across charts
 * Uses closure-based state, not a React hook
 *
 * @param object - Configuration object
 * @param props.keys - Array of keys
 * @param props.colors - Array of color values
 * @returns Color map
 */
export const createColorMap = ({ keys, colors = defaultColors }: { keys: string[]; colors?: string[] }) => {
	const colorMap = new Map<string, string>();

	// used for "color wraparound" modulo
	let colorIndex = 0;

	keys.forEach((key) => {
		const assignedColor = colors[colorIndex++ % colors.length];
		colorMap.set(key, assignedColor);
	});

	return colorMap;
};
