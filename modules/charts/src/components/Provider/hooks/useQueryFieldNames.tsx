import { NumericAggregationsOptions } from '#components/charts/Barchart/Barchart';
import { ChartAggregation } from '#components/charts/Barchart/hooks/useValidateInput';
import { toJSONFieldName } from '#utils/mappings';
import { useCallback, useState } from 'react';

export const fieldNameWithMapping = ({ fieldName, extendedMapping }) => {
	// GQL field name to Arranger extended mapping JSON field name
	const jsonFieldName = toJSONFieldName(fieldName);
	const mapping = extendedMapping.find((mapping) => mapping.fieldName === jsonFieldName);
	console.log(mapping);
	if (mapping?.aggsType) {
		console.log(`Found mapping for ${fieldName} => ${mapping.aggsType}`);
		return { fieldName, gqlTypename: mapping.aggsType };
	}

	console.log(`Missing mapping for ${fieldName}`);
	return null;
};

export type QueryValue = {
	fieldName: string;
	variables: NumericAggregationsOptions;
};

/**
 * Custom hook for managing query field names and their GraphQL type mappings.
 *
 * This hook maintains a registry of field names with mappings to their corresponding
 * GraphQL types using the provided extended mapping configuration. It prevents
 * duplicate registrations and provides methods to add/remove fields dynamically.
 *
 * @param config - Configuration object containing the extended mapping
 * @param config.
 * @returns Object containing query fields array and registration/deregistration functions
 */
export const useQueryValues = (): {
	queryFields: Map<string, ChartAggregation>;
	registerFieldName: (config: ChartAggregation) => void;
	deregisterFieldName: (fieldName: string) => void;
} => {
	// Although we can have multiple charts with same fieldName, they are referencing the same data.
	// Important! - GQL aliasing if currently not supported, Map keys unique constraint is ok for now.
	const [registeredQueryValues, setRegisteredQueryValues] = useState(new Map<string, {}>());

	const registerQueryValue = useCallback((config) => {
		setRegisteredQueryValues((prev) => {
			if (prev.has(config.fieldName)) {
				console.log(`Field already registered: ${config.fieldName}`);
				return prev;
			} else {
				const newValuesMap = new Map(prev);
				newValuesMap.set(config.fieldName, config);
				console.log(`Field registered successfully: ${config.fieldName}`);
				console.log(`Current registered fields: ${Array.from(newValuesMap)}`);
				return newValuesMap;
			}
		});
	}, []);

	const deregisterQueryValue = useCallback((fieldName: string) => {
		setRegisteredQueryValues((prev) => {
			if (!prev.has(fieldName)) {
				console.log(`Field not found for deregistration: ${fieldName}`);
				return prev;
			}

			const newValuesMap = new Map(prev);
			newValuesMap.delete(fieldName);
			console.log(`Field deregistered successfully: ${fieldName}`);
			console.log(`Current registered fields: ${Array.from(newValuesMap)}`);
			return newValuesMap;
		});
	}, []);

	return {
		queryFields: registeredQueryValues,
		registerFieldName: registerQueryValue,
		deregisterFieldName: deregisterQueryValue,
	};
};
