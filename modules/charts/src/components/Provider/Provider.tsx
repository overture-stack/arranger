import { useArrangerData } from '@overture-stack/arranger-components';
import { cloneDeep, merge } from 'lodash';
import { createContext, PropsWithChildren, ReactElement, useContext, useEffect, useState } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { DnaLoader } from './DnaLoader';
import { EmptyData } from './EmptyData';
import { ErrorData } from './ErrorData';
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
	// TODO: Error check this, could very well be empty example if user is not logged in
	return new Map(Object.entries(data.data.file.aggregations));
};

type Chart = {
	chartType: string;
	fieldName: string;
	displayValues: Record<string, string>;
	ranges?: any;
};

type ChartGroup = Record<string, Record<string, Chart>>;

type ChartsConfig = {
	groups: Record<string, ChartGroup>;
};

export const ChartsProvider = ({ theme, children }: ChartsProviderProps) => {
	// Ensure there is an ArrangerDataProvider context available
	// apiFetcher is consumer function passed into ArrangerDataProvider, currently no default
	const { documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	// TODO: minimal for POC, some consistency with other data fetchers might be good
	const [chartsConfigs, setChartConfigs] = useState<ChartsConfig>();
	useEffect(() => {
		const fetchData = async () => {
			try {
				const data = await theme.dataFetcher({
					body: { query: `query ChartsConfig { file { configs { charts } } }` },
				});

				const config = data.data.file.configs.charts;

				setChartConfigs(config);
			} catch (error) {
				console.log('error fetching charts config', error);
			}
		};

		fetchData();
	}, []);

	const { apiState } = useNetworkQuery({
		query: chartsConfigs?.query,
		documentType,
		apiFetcher,
		sqon,
	});

	// TODO: clean up return pattern
	if (!chartsConfigs) return null;

	console.log('configs charts', chartsConfigs);

	// default global theme
	const globalTheme: GlobalTheme = merge(
		cloneDeep({
			components: { Tooltip, ErrorData, Loader: DnaLoader, EmptyData },
		}),
		theme,
	);

	const chartDataMap = createChartDataMap({ data: apiState?.data });

	const registerChart = async ({ fieldName }) => {
		// TODO: remove, now backend driven no need to dynamically add on child component add
		//		addToQuery({ fieldName });
	};

	const deregisterChart = ({ fieldName }) => {
		// TODO: remove, now backend driven no need to dynamically add on child component add
		//		removeFromQuery({ fieldName });
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
		globalTheme,
		registerChart,
		deregisterChart,
		update,
		getChartData,
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
