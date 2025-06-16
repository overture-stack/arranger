};
import { useArrangerData } from '@overture-stack/arranger-components';
import { createContext, PropsWithChildren, ReactElement, useContext, useMemo, useRef } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { createChartColors } from './Colors/colors';
import { EmptyData } from './EmptyData';
import { ErrorData } from './ErrorData';
import { Loader } from './Loader/Loader';
import { Tooltip } from './Tooltip';

type ChartContextType = {
	globalTheme: GlobalTheme;
	registerChart: ({ fieldName }: { fieldName: string }) => void;
	deregisterChart: ({ fieldName }: { fieldName: string }) => void;
	getChartData: ({ fieldName }: { fieldName: string }) => {
		isLoading: boolean;
		isError: boolean;
		// TODO: Map<string, Aggregtions | NumericAggregations>
		data: Map<string, {}> | undefined;
	};
};

export const ChartsContext = createContext<ChartContextType | null>(null);

/**
 * global theme for all charts using ChartsProvider
 */
type GlobalTheme = {
	colors?: string[];
	components?: {
		TooltipComp?: ReactElement;
		Loader?: ReactElement;
		ErrorData?: ReactElement;
		EmptyData?: ReactElement;
	};
};
type ChartsProviderProps = PropsWithChildren<{ theme: GlobalTheme }>;

const createChartDataMap = ({ data }) => {
	if (!data) {
		return null;
	}
	// TODO: Dynamic property
	return new Map(Object.entries(data.data.file.aggregations));
};

export const ChartsProvider = ({
	theme = {
		colors: ['red', 'green', 'blue'],
		components: { Tooltip, ErrorData, Loader, EmptyData },
	},
	children,
}: ChartsProviderProps) => {
	const { documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	const isInitialized = useRef(false);

	// call once, not a hook
	const { resolveColor, createColorMap } = useMemo(() => createChartColors({ colors: theme.colors }), []);

	// apiFetcher is consumer function passed into ArrangerDataProvider, currently no default

	const { apiState, addToQuery, removeFromQuery } = useNetworkQuery({
		documentType,
		apiFetcher,
		sqon,
	});

	// first time? maybe hook for state, closer to derived state
	const chartDataMap = createChartDataMap({ data: apiState?.data });

	if (
		apiState.loading === false &&
		apiState.error === false &&
		apiState.data !== undefined &&
		isInitialized.current === false &&
		chartDataMap
	) {
		/**
		 * need consistent keys even when query changes and becomes filtered down
		 * initialize once with all keys
		 */
		createColorMap(chartDataMap);
		isInitialized.current = true;
	}

	const registerChart = async ({ fieldName }) => {
		addToQuery({ fieldName });
	};

	const deregisterChart = ({ fieldName }) => {
		removeFromQuery({ fieldName });
	};

	const update = ({ fieldName, eventData }) => {
		console.log('update', fieldName, eventData);
		// new data => sqon => arranger => data => render
		// update arranger.setSqon
		setSQON();
	};

	// chartType for slicing data
	const getChartData = ({ fieldName }) => {
		const chartData = chartDataMap?.get(fieldName);

		return {
			isLoading: apiState.loading,
			isError: apiState.error,
			data: chartData,
		};
	};

	const chartContext: ChartContextType = {
		globalTheme: theme,
		registerChart,
		deregisterChart,
		update,
		getChartData,
		resolveColor,
	};

	return <ChartsContext.Provider value={chartContext}>{children}</ChartsContext.Provider>;
};

export const useChartsContext = () => {
	const context = useContext(ChartsContext);
	if (!context) {
		throw new Error('context has to be used within <Charts.Provider>');
	}
	return context;
};
