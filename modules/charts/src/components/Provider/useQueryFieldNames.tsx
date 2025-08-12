import { NumericAggregationsOptions } from '#components/charts/BarChart/BarChart';
import { ChartConfig } from '#components/charts/BarChart/useValidateInput';
import { logger } from '#logger';
import { useCallback, useState } from 'react';

export type QueryValue = {
	fieldName: string;
	variables: NumericAggregationsOptions;
};

/**
 * Custom hook for managing query field names and their GraphQL type mappings.
 *
 * This hook maintains a registry of field names with their configurgations.
 * It prevents duplicate registrations and provides methods to add/remove fields dynamically.
 *
 * @returns Object containing query fields array and registration/deregistration functions
 */
export const useQueryValues = (): {
	queryFields: Map<string, ChartConfig>;
	registerFieldName: (config: ChartConfig) => void;
	deregisterFieldName: (fieldName: string) => void;
} => {
	// Although we can have multiple charts with same fieldName, they are referencing the same data.
	// Important! - GQL aliasing if currently not supported, Map keys unique constraint is ok for now.
	const [registeredQueryValues, setRegisteredQueryValues] = useState(new Map<string, ChartConfig>());

	const registerQueryValue = useCallback((config) => {
		setRegisteredQueryValues((prev) => {
			// handle array
			console.log('ccc', config);
			if (prev.has(config.fieldName)) {
				logger.log(`Field already registered: ${config.fieldName}`);
				return prev;
			} else {
				const newValuesMap = new Map(prev);
				newValuesMap.set(config.fieldName, config);
				logger.log(`Field registered successfully: ${config.fieldName}`);
				logger.log(`Current registered fields: ${Array.from(newValuesMap)}`);
				return newValuesMap;
			}
		});
	}, []);

	const deregisterQueryValue = useCallback((fieldName: string) => {
		setRegisteredQueryValues((prev) => {
			if (!prev.has(fieldName)) {
				logger.log(`Field not found for deregistration: ${fieldName}`);
				return prev;
			}

			const newValuesMap = new Map(prev);
			newValuesMap.delete(fieldName);
			logger.log(`Field deregistered successfully: ${fieldName}`);
			logger.log(`Current registered fields: ${Array.from(newValuesMap)}`);
			return newValuesMap;
		});
	}, []);

	return {
		queryFields: registeredQueryValues,
		registerFieldName: registerQueryValue,
		deregisterFieldName: deregisterQueryValue,
	};
};
