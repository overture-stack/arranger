import { ExtendedMappingInterface } from '@overture-stack/arranger-components';

import { logger } from '#logger';
import { toJSONFieldName } from '#utils/mappings';

/**
 * Maps a GraphQL field name to its extended mapping configuration.
 * Resolves field name format and finds corresponding aggregation type information.
 *
 * @param { fieldName } - GraphQL field name to map
 * @param { extendedMapping } - Array of field mapping configurations from Arranger
 * @returns Mapping object with field name and GraphQL typename, or null if not found
 */
export const fieldNameWithMapping = ({
	fieldName,
	extendedMapping,
}: {
	fieldName: string;
	extendedMapping: ExtendedMappingInterface[];
}) => {
	// GQL field name to Arranger extended mapping JSON field name
	const jsonFieldName = toJSONFieldName(fieldName);
	const mapping = extendedMapping.find((mapping) => mapping.fieldName === jsonFieldName);

	if (mapping?.aggsType) {
		logger.debug(`Found mapping for ${fieldName} => ${mapping.aggsType}`);
		return { fieldName, gqlTypename: mapping.aggsType };
	}

	logger.debug(`Missing mapping for ${fieldName}`);
	return null;
};
