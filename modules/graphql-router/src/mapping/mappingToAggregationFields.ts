import { esToAggTypesMap } from '@overture-stack/arranger-types/elastic/constants';

import type { AggregationField } from '#network/types/setup.js';

import { flattenMappingToFields } from './extendMapping.js';
import convertNameForGraphql from './utils/convertNameForGraphql.js';

/**
 * From a mapping, extract all Aggregations as an array of AggregationFields.
 *
 * TODO: clean the typing for properties param
 * TODO: improved type testing to ensure we get only Aggregations.
 */
const mappingToAggregationFields = (properties: any, parent = ''): AggregationField[] =>
	flattenMappingToFields(properties)
		.map((field) =>
			field.type !== 'nested'
				? {
						name: convertNameForGraphql(field.fieldName),
						type: esToAggTypesMap[field.type],
					}
				: undefined,
		)
		.filter((field) => field !== undefined);

export default mappingToAggregationFields;
