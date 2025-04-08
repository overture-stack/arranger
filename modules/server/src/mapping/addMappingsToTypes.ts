import getNestedFields from './getNestedFields.js';

let addMappingsToTypes = ({ graphQLType, mapping }) => {
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
