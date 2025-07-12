import { useArrangerData } from '@overture-stack/arranger-components';
import { createContext, PropsWithChildren, ReactElement, useContext, useMemo, useState } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { generateChartsQuery } from '#query/ChartQueryBuilder';
import { cloneDeep, merge } from 'lodash';
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
	console.log('ddddd', data);
	// TODO: Dynamic property
	// TODO: Error check this, could very well be empty example if user is not logged in
	return new Map(Object.entries(data.data.file.aggregations));
};

// merged passed theme with defaults
const createGlobalTheme = ({ theme }) => {
	return merge(
		cloneDeep({
			components: { Tooltip, ErrorData, EmptyData },
		}),
		theme,
	);
};

const useChartFields = ({ documentType }) => {
	const [registeredFieldNames, setRegisteredFieldNames] = useState(new Set());

	const registerFieldName = (fieldName: string) => {
		setRegisteredFieldNames((prev) => {
			if (prev.has(fieldName)) {
				console.log('Field already registered:', fieldName);
				return prev;
			}

			const newFields = new Set(prev);
			newFields.add(fieldName);
			console.log('Field registered successfully:', fieldName);
			console.log('Current registered fields:', Array.from(newFields));
			return newFields;
		});
	};

	const deregisterFieldName = (fieldName: string) => {
		setRegisteredFieldNames((prev) => {
			if (!prev.has(fieldName)) return prev;

			const newFields = new Set(prev);
			newFields.delete(fieldName);
			return newFields;
		});
	};

	// Generate query from current fields
	const gqlQuery = useMemo(() => {
		return generateChartsQuery({ documentType, fieldNames: registeredFieldNames });
	}, [documentType, registeredFieldNames]);

	return {
		gqlQuery,
		registerFieldName,
		deregisterFieldName,
	};
};

export const ChartsProvider = ({ theme, children }: ChartsProviderProps) => {
	// Ensure there is an ArrangerDataProvider context available, arrangerData doesn't throw error
	// apiFetcher is consumer function passed into ArrangerDataProvider, currently no default
	const { documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	// create query instance
	const { gqlQuery, registerFieldName, deregisterFieldName } = useChartFields({ documentType });

	// api call
	const { apiState } = useNetworkQuery({
		query: gqlQuery,
		apiFetcher,
		sqon,
	});
	console.log('api', apiState);
	const chartDataMap = createChartDataMap({ data: apiState?.data });

	// default global theme
	const globalTheme: GlobalTheme = createGlobalTheme({ theme });

	const registerChart = ({ fieldName }) => {
		console.log('Registering fieldName', fieldName);
		registerFieldName(fieldName);
	};

	const deregisterChart = ({ fieldName }) => {
		console.log('Deregistering fieldName', fieldName);
		deregisterFieldName(fieldName);
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
