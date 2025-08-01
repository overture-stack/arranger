import { ChartText } from './ChartText';
import { useChartsContext } from './Provider/Provider';

export const ChartRenderer = ({ isLoading, isError, isEmpty, components, Chart }) => {
	const { globalTheme } = useChartsContext();

	if (isLoading) {
		const LoaderComponent = globalTheme?.components?.Loader || components.Loader;
		return LoaderComponent ? <LoaderComponent /> : <ChartText text="Loading..." />;
	}

	if (isError) {
		const ErrorComponent = globalTheme?.components?.ErrorData || components.ErrorData;
		return ErrorComponent ? <ErrorComponent /> : <ChartText text="Error" />;
	}

	if (isEmpty) {
		const EmptyComponent = globalTheme?.components?.EmptyData || components.EmptyData;
		return EmptyComponent ? <EmptyComponent /> : <ChartText text="No Data Available" />;
	}

	if (Chart) {
		return <Chart />;
	}
};
