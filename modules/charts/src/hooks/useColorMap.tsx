import { useThemeContext } from '#components/ChartsThemeProvider';

/**
 * Custom hook that creates and maintains a persistent color map for chart data.
 * Uses useRef to ensure color consistency across re-renders.
 *
 * @param { chartData } - Chart data to generate colors for
 * @param { resolver } - Function that creates color map from chart data
 * @returns Object containing the generated color map
 */
export const useColorMap = ({ colorMapRef, chartData, resolver }) => {
	const { colors } = useThemeContext();

	if (chartData && !colorMapRef?.current) {
		colorMapRef.current = resolver({ chartData, colors });
	}

	return { colorMap: colorMapRef.current };
};
