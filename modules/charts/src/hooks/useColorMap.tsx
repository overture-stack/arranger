import { useThemeContext } from '#components/ChartsThemeProvider';

const KEY_PREFIX = 'arranger-charts';
const makeKey = ({ fieldName }) => {
	return `${KEY_PREFIX}-${fieldName}`;
};

const parseStoredMap = (storedValue) => {
	const parsedValue = JSON.parse(storedValue);
	return new Map(Object.entries(parsedValue));
};

/**
 * Custom hook that creates and maintains a persistent color map for chart data.
 * Uses useRef to ensure color consistency across re-renders.
 *
 * uses session storage, no cross tab sync, improve to local storage if use case
 *
 * @param { chartData } - Chart data to generate colors for
 * @param { resolver } - Function that creates color map from chart data
 * @returns Object containing the generated color map
 */
export const useColorMap = ({ fieldName, colorMapRef, chartData, resolver }) => {
	const { colors } = useThemeContext();

	const cacheKey = makeKey({ fieldName });

	const storedValue = sessionStorage.getItem(cacheKey);
	let savedMap = new Map();
	if (chartData) {
		if (storedValue) {
			savedMap = parseStoredMap(storedValue);
		}

		const resolvedColorMap = resolver({ chartData, colors, savedMap });
		colorMapRef.current = resolvedColorMap;
		sessionStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries(resolvedColorMap)));
	}

	return { colorMap: colorMapRef.current };
};
