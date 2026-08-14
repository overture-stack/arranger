import getNestedFields from './getNestedFields.js';
import type { GraphqlNameRegistry } from './utils/graphqlNameRegistry.js';

/**
 * Combines the mapping with the graphQLType content.
 *
 * This also provides a property `nested_fieldNames` that lists all nested fields from the mapping,
 * attaches `registry` as `graphqlNameRegistry` (read by `mappingToFields` and its recursive callees
 * to translate raw field names into GraphQL-safe ones), and returns this as a tuple with the
 * graphQLType.name as the first element.
 */
const addMappingsToTypes = ({
	graphQLType,
	mapping,
	registry,
}: {
	graphQLType: any;
	mapping: any;
	registry: GraphqlNameRegistry;
}): [string, Record<string, any>] => {
	const nested_fieldNames = getNestedFields(mapping);

	return [
		graphQLType.name,
		{
			...graphQLType,
			graphqlNameRegistry: registry,
			mapping,
			nested_fieldNames,
		},
	];
};

export default addMappingsToTypes;
