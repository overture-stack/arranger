import { useArrangerData } from '@overture-stack/arranger-components';

import { getGQLTypename } from '#arranger/mapping';
import { AggregationsTypename } from '#shared';

export type ValidationInput = {
	fieldName: string; // Multiple fields for hierarchy
};

export type ChartConfig = ValidationInput & {
	gqlTypenames: AggregationsTypename[];
};

/**
 * Custom hook that validates sunburst chart input parameters
 * Checks field mapping compatibility for all fields
 *
 * @param { fieldName } - Array of GraphQL field names to validate
 * @returns Valid chart aggregation configuration or null if validation fails
 */
export const useValidateInput = ({ fieldName }: ValidationInput): ChartConfig | null => {
	const { extendedMapping } = useArrangerData();
	console.log('extende mapping', extendedMapping);

	// if (!fieldNames || fieldNames.length !== 2) {
	// 	logger.log(
	// 		'Sunburst chart requires a tuple of fieldNames for hierarchy. Example: [<parent_field>,<child_field>]',
	// 	);
	// 	return null;
	// }

	// // Map all field names and validate their types
	// const mappedFieldNames = fieldNames.map((fieldName) => fieldNameWithMapping({ fieldName, extendedMapping }));

	// // Check if any field mapping failed
	// if (mappedFieldNames.some((mapped) => !mapped)) {
	// 	logger.log('One or more fieldNames could not be mapped');
	// 	return null;
	// }

	// // Get all GraphQL typenames
	// const gqlTypenames = mappedFieldNames.map((mapped) => mapped.gqlTypename);

	// // For sunburst, all fields should have Aggregations type
	// const allSameType = gqlTypenames.every((typename) => typename === aggregationsTypenames.Aggregations);

	// if (!allSameType) {
	// 	logger.log('All fieldNames must use Arragner "Aggregations" type for sunburst chart');
	// 	return null;
	// }

	// valid
	return getGQLTypename({ fieldName, extendedMapping });
};
