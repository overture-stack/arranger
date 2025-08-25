import { useRef } from 'react';

/**
 * Custom hook that creates and maintains a persistent color map for chart data.
 * Uses useRef to ensure color consistency across re-renders.
 *
 * @param { chartData } - Chart data to generate colors for
 * @param { resolver } - Function that creates color map from chart data
 * @returns Object containing the generated color map
 */
export const useColorMap = ({ chartData, resolver, colors }) => {
	const colorMap = useRef();
	if (chartData && !colorMap.current) {
		colorMap.current = resolver({ chartData, colors });
	}
	return { colorMap: colorMap.current };
};
