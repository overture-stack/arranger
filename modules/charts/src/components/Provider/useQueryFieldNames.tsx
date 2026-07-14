import { logger } from '#logger';
import { generateChartsQuery } from '#query/generateCharts';
import { useCallback, useMemo, useState } from 'react';
import type { ChartQuery } from './chartsContextTypes';

/**
 * Hook to manage dynamic query for a collection of charts.
 * It prevents duplicate registrations and provides methods to add/remove fields dynamically.
 * Important! - GQL aliasing is currently not supported, Map keys unique constraint is ok for now.
 *
 * @returns gql query string
 */
export const useDynamicQuery = (params: {
	enableNetworkQuery?: boolean;
	disableIncludeMissing: boolean;
	documentType: string;
}): {
	addQuery: (config: ChartQuery) => void;
	gqlQuery: string | null;
	removeQuery: (fieldName: string, isNetworkAggregation: boolean) => void;
	requireNetworkSearch: () => void;
} => {
	const { disableIncludeMissing, documentType } = params;
	// Although we can have multiple charts with same fieldName, they are referencing the same data.
	const [queryFields, setQueryFields] = useState(new Map<string, ChartQuery>());
	const [networkAggregationQueries, setNetworkAggregationQueries] = useState(new Map<string, ChartQuery>());

	// requireNetworkSearch indicates that we need to execute network query for nodes, even if ther are no network aggregation queries
	const [isRequireNetworkSearch, setRequireNetworkSearch] = useState(false);

	const addQuery = useCallback((query: ChartQuery) => {
		const { fieldName, isNetworkAggregation } = query;
		if (isNetworkAggregation) {
			setNetworkAggregationQueries((prev) => {
				// There is no current reason to check if this chart has been registered before, we can just set it again
				// Need to rebuild the Map to ensure we get the state update
				const newValuesMap = new Map(prev);
				newValuesMap.set(fieldName, query);
				logger.debug(`Registered Chart for Network Aggregation on field '${fieldName}'`);
				return newValuesMap;
			});
		} else {
			// Normal Aggregation Query:
			setQueryFields((prev) => {
				if (prev.has(fieldName)) {
					logger.debug(`A chart is already registered using the field name '${fieldName}'.`);
					return prev;
				} else {
					const newValuesMap = new Map(prev);
					newValuesMap.set(fieldName, query);
					logger.debug(`Registered Chart for aggregations on field '${fieldName}'`);
					return newValuesMap;
				}
			});
		}
	}, []);

	const removeQuery = useCallback((fieldName: string, isNetworkAggregation: boolean) => {
		// TODO: Need to keep unique records for every registration and only remove them one at a time. The gql generation can de-duplicate the fields.
		if (isNetworkAggregation) {
			setNetworkAggregationQueries((prev) => {
				const newValuesMap = new Map(prev);
				newValuesMap.delete(fieldName);
				logger.debug(`Field deregistered for Network Aggregation chart query: '${fieldName}'`);
				logger.debug(`Current registered fields: ${Array.from(newValuesMap)}`);
				return newValuesMap;
			});
		} else {
			setQueryFields((previousQuery) => {
				if (!previousQuery.has(fieldName)) {
					logger.debug(`Field not found for deregistration: ${fieldName}`);
					return previousQuery;
				}

				const newValuesMap = new Map(previousQuery);
				newValuesMap.delete(fieldName);
				logger.debug(`Field deregistered successfully: ${fieldName}`);
				logger.debug(`Current registered fields: ${Array.from(newValuesMap)}`);
				return newValuesMap;
			});
		}
	}, []);

	// generate query from current fields
	const gqlQuery = useMemo(() => {
		return generateChartsQuery({
			disableIncludeMissing,
			documentType,
			queryFields,
			isRequireNetworkSearch,
			networkQueryFields: networkAggregationQueries,
		});
	}, [disableIncludeMissing, documentType, queryFields, isRequireNetworkSearch, networkAggregationQueries]);

	const requireNetworkSearch = useCallback(() => {
		setRequireNetworkSearch(true);
	}, []);

	return {
		addQuery,
		gqlQuery,
		removeQuery,
		requireNetworkSearch,
	};
};
