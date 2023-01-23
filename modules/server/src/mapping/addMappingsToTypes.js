import getNestedFields from './getNestedFields';

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
