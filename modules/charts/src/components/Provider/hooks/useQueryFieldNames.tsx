import { toJSONFieldName } from '#utils/mappings';
import { ExtendedMappingInterface } from '@overture-stack/arranger-components';
import { useCallback, useMemo, useState } from 'react';

export type QueryField = {
	fieldName: string;
	// TODO: specify Aggs or NumericAggs
	gqlTypename: string;
};

/**
 * Custom hook for managing query field names and their GraphQL type mappings.
 *
 * This hook maintains a registry of field names with mappings to their corresponding
 * GraphQL types using the provided extended mapping configuration. It prevents
 * duplicate registrations and provides methods to add/remove fields dynamically.
 *
 * @param config - Configuration object containing the extended mapping
 * @param config.extendedMapping - Arranger extended mapping interface for field type resolution
 * @returns Object containing query fields array and registration/deregistration functions
 */
export const useQueryFieldNames = ({
	extendedMapping,
}: {
	extendedMapping: ExtendedMappingInterface[];
}): {
	queryFields: QueryField[];
	registerFieldName: (fieldName: string) => void;
	deregisterFieldName: (fieldName: string) => void;
} => {
	// Although we can have multiple charts with same fieldName, they are referencing the same data
	const [registeredFieldNames, setRegisteredFieldNames] = useState(new Set<string>());

	const registerFieldName = useCallback((fieldName: string) => {
		setRegisteredFieldNames((prev) => {
			if (prev.has(fieldName)) {
				console.log(`Field already registered: ${fieldName}`);
				return prev;
			} else {
				const newFields = new Set(prev);
				newFields.add(fieldName);
				console.log(`Field registered successfully: ${fieldName}`);
				console.log(`Current registered fields: ${Array.from(newFields)}`);
				return newFields;
			}
		});
	}, []);

	const deregisterFieldName = useCallback((fieldName: string) => {
		setRegisteredFieldNames((prev) => {
			if (!prev.has(fieldName)) {
				console.log(`Field not found for deregistration: ${fieldName}`);
				return prev;
			}

			const newFields = new Set(prev);
			newFields.delete(fieldName);
			console.log(`Field deregistered successfully: ${fieldName}`);
			console.log(`Current registered fields: ${Array.from(newFields)}`);
			return newFields;
		});
	}, []);

	const queryFields = useMemo(() => {
		return Array.from(registeredFieldNames).flatMap((fieldName) => {
			// GQL field name to Arranger extended mapping JSON field name
			const jsonFieldName = toJSONFieldName(fieldName);
			const mapping = extendedMapping.find((mapping) => mapping.fieldName === jsonFieldName);

			if (mapping?.aggsType) {
				console.log(`Found mapping for ${fieldName} => ${mapping.aggsType}`);
				return [{ fieldName, gqlTypename: mapping.aggsType }];
			}

			console.log(`Missing mapping for ${fieldName}`);
			return [];
		});
	}, [registeredFieldNames, extendedMapping]);

	return {
		queryFields,
		registerFieldName,
		deregisterFieldName,
	};
};
