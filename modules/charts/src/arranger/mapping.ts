import { DisplayType, ExtendedMappingInterface } from '@overture-stack/arranger-components';
import { sanitizeGraphqlFlatName } from '@overture-stack/arranger-types/tools';

import { logger } from '#logger';
import { aggregationsTypenames } from '.';

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
 * Finds the matching `extendedMapping` entry by sanitizing each candidate's raw field name and
 * comparing forward, rather than trying to reverse the GraphQL name back to a raw path: once
 * sanitization handles more than dots (e.g. a hyphen becoming `_`), that reversal is ambiguous.
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
	const mapping = extendedMapping?.find((mapping) => sanitizeGraphqlFlatName(mapping.fieldName) === fieldName);

	const aggType = mapping?.type && esToAggTypeMap[mapping?.type];
	if (aggType) {
		logger.debug(`Found mapping for ${fieldName} => ${aggType}`);
		return aggType;
	}

	logger.debug(`Missing mapping for ${fieldName}`);
	return aggregationsTypenames.Aggregations;
};
