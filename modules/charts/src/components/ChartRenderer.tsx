import { ChartText } from './ChartText';
import { useThemeContext } from './theme/Provider';

/**
 * Renders appropriate chart component or fallback state based on data loading status.
 * Supports global theme overrides and custom component injection.
 *
 * @param props - Renderer configuration
 * @param props.isLoading - Whether data is currently being fetched
 * @param props.isError - Whether an error occurred during data fetching
 * @param props.isEmpty - Whether the fetched data is empty
 * @param props.components - Chart specific fallback components
 * @param props.Chart - Main chart component to render when data is ready
 * @returns JSX element with chart or appropriate fallback component
 */
export const ChartRenderer = ({ isLoading, isError, isEmpty, Chart }) => {
	const { components } = useThemeContext();

	if (isLoading) {
		const LoaderComponent = components?.Loader;
		return LoaderComponent ? <LoaderComponent /> : <ChartText text="Loading..." />;
	}

	if (isError) {
		const ErrorComponent = components?.ErrorData;
		return ErrorComponent ? <ErrorComponent /> : <ChartText text="Error" />;
	}

	if (isEmpty) {
		const EmptyComponent = components?.EmptyData;
		return EmptyComponent ? <EmptyComponent /> : <ChartText text="No Data Available" />;
	}

	if (Chart) {
		return <Chart />;
	}
};
