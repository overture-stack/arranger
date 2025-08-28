import { NumericAggregationsOptions } from '#components/charts/Bar/BarChart';
import { logger } from '#logger';
import { generateChartsQuery } from '#query/generateCharts';
import { useCallback, useMemo, useState } from 'react';

export type Query = {
	fieldName: string;
	variables: NumericAggregationsOptions;
	gqlTypename: string;
};

/**
 * Hook to manage dynamic query for a collection of charts.
 * It prevents duplicate registrations and provides methods to add/remove fields dynamically.
 * Important! - GQL aliasing if currently not supported, Map keys unique constraint is ok for now.
 *
 * @returns gql query string
 */
export const useDynamicQuery = ({
	documentType,
}): {
	addQuery: (config: ChartConfig) => void;
	removeQuery: (fieldName: string) => void;
} => {
	// Although we can have multiple charts with same fieldName, they are referencing the same data.
	const [queryFields, setQueryFields] = useState(new Map<string, Query>());

	const addQuery = useCallback((query) => {
		const { fieldName } = query;
		setQueryFields((prev) => {
			if (prev.has(fieldName)) {
				logger.debug(`Field already registered: ${fieldName}`);
				return prev;
			} else {
				const newValuesMap = new Map(prev);
				newValuesMap.set(fieldName, query);
				logger.debug(`Field registered successfully: ${fieldName}`);
				logger.debug(`Current registered fields: ${Array.from(newValuesMap)}`);
				return newValuesMap;
			}
		});
	}, []);

	const removeQuery = useCallback((fieldName: string) => {
		setQueryFields((prev) => {
			if (!prev.has(fieldName)) {
				logger.debug(`Field not found for deregistration: ${fieldName}`);
				return prev;
			}

			const newValuesMap = new Map(prev);
			newValuesMap.delete(fieldName);
			logger.debug(`Field deregistered successfully: ${fieldName}`);
			logger.debug(`Current registered fields: ${Array.from(newValuesMap)}`);
			return newValuesMap;
		});
	}, []);

	// generate query from current fields
	const gqlQuery = useMemo(() => {
		return generateChartsQuery({ documentType, queryFields });
	}, [documentType, queryFields]);

	return {
		addQuery,
		removeQuery,
		gqlQuery,
	};
};
