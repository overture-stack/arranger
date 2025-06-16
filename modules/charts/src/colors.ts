/**
 * Creates a chart color map for consistent colors across charts
 * Uses closure-based state, not a React hook
 *
 * @param options - Configuration object
 * @param options.colors - Array of color values to use
 * @returns Object with methods to manage the color map
 */
export const createChartColors = ({ colors, keys }: { colors: Array<string> }) => {
	const colorMap = new Map<string, string>();

	// used for "color wraparound" modulo
	let colorIndex = 0;

	return {
		/**
		 * Creates a color map for charts
		 *
		 * @returns Map of keys to assigned colors
		 */
		createColorMap: (data: Map<string, any>) => {
			if (!data || colorMap.size !== 0) {
				return;
			}
			for (const [key, value] of data.entries()) {
				const buckets = value.buckets; // TODO: numeric agg diff property
				buckets.forEach((bucket) => {
					const assignedColor = colors[colorIndex++ % colors.length];
					colorMap.set(`${key}.${bucket.key}`, assignedColor);
				});
			}
			return colorMap;
		},

		/**
		 * Returns the current color map.
		 *
		 * @returns Map of keys to assigned colors
		 */
		resolveColor: ({ key }) => {
			//	console.log('closure', colorMap);
			return colorMap.get(key);
		},
	};
};
