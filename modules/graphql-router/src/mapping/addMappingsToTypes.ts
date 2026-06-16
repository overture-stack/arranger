import getNestedFields from './getNestedFields.js';

/**
 * Combines the mapping with the graphQLType content.
 *
 * This also provides a property `nested_fieldNames` that lists all nested fields from the mapping,
 * and returns this as a tuple with the graphQLType.name as the first element.
 */
const addMappingsToTypes = ({
	graphQLType,
	mapping,
}: {
	graphQLType: any;
	mapping: any;
}): [string, Record<string, any>] => {
	const nested_fieldNames = getNestedFields(mapping);

	return [
		graphQLType.name,
		{
			...graphQLType,
			mapping,
			nested_fieldNames,
		},
	];
};

export default addMappingsToTypes;
