import { DisplayType, ExtendedMappingInterface } from '@overture-stack/arranger-components';

import { logger } from '#logger';
import { aggregationsTypenames } from '.';

// GQL field name to Arranger extended mapping JSON field name
export const toJSONFieldName = (fieldName: string) => {
	return fieldName.replaceAll('__', '.');
};

const esToAggTypeMap: Record<DisplayType | string, string> = {
	boolean: 'Aggregations',
	bytes: 'NumericAggregations',
	date: 'NumericAggregations',
	double: 'NumericAggregations',
	float: 'NumericAggregations',
	half_float: 'NumericAggregations',
	id: 'Aggregations',
	integer: 'NumericAggregations',
	keyword: 'Aggregations',
	long: 'NumericAggregations',
	object: 'Aggregations',
	scaled_float: 'NumericAggregations',
	string: 'Aggregations',
	text: 'Aggregations',
	unsigned_long: 'NumericAggregations',
} as const;

/**
 * Maps a GraphQL field name to its extended mapping configuration.
 * Resolves field name format and finds corresponding aggregation type information.
 *
 * @param { fieldName } - GraphQL field name to map
 * @param { extendedMapping } - Array of field mapping configurations from Arranger
 * @returns Mapping object with field name and GraphQL typename, or null if not found
 */
export const getGQLTypename = ({
	fieldName,
	extendedMapping,
}: {
	fieldName: string;
	extendedMapping: ExtendedMappingInterface[];
}) => {
	// GQL field name to Arranger extended mapping JSON field name
	const jsonFieldName = toJSONFieldName(fieldName);
	const mapping = extendedMapping?.find((mapping) => mapping.fieldName === jsonFieldName);

	const aggType = mapping?.type && esToAggTypeMap[mapping?.type];
	if (aggType) {
		logger.debug(`Found mapping for ${fieldName} => ${aggType}`);
		return aggType;
	}

	logger.debug(`Missing mapping for ${fieldName}`);
	return aggregationsTypenames.Aggregations;
};
