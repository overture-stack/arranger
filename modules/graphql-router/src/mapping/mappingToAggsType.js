import { esToAggTypesMap } from '@overture-stack/arranger-types/elastic';

import { flattenMappingToFields } from './extendMapping.js';
import convertNameForGraphql from './utils/convertNameForGraphql.js';

/**
 * Retrieve from the search index mappings an array of type strings that can be used in the
 * GraphQL Schema definition.
 */
const mappingToAggsType = (mappings) =>
	flattenMappingToFields(mappings)
		.filter((field) => field.type !== 'nested')
		.map((field) =>
			field.type !== 'nested'
				? `${convertNameForGraphql(field.fieldName)}: ${esToAggTypesMap[field.type]}`
				: undefined,
		)
		.filter((field) => field !== undefined);

export default mappingToAggsType;
