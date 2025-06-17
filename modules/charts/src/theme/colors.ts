/**
 * Creates a chart color map for consistent colors across charts
 * Uses closure-based state, not a React hook
 *
 * @param object - Configuration object
 * @param props.keys - Array of keys
 * @param props.colors - Array of color values
 * @returns Color map
 */
export const createColorMap = ({ keys, colors }: { keys: string[]; colors: string[] }) => {
	const colorMap = new Map<string, string>();

	// used for "color wraparound" modulo
	let colorIndex = 0;

	keys.forEach((key) => {
		const assignedColor = colors[colorIndex++ % colors.length];
		colorMap.set(key, assignedColor);
	});

	return colorMap;
};
