import getNestedFields from './getNestedFields';

let addMappingsToTypes = ({ graphQLType, mapping }) => [
  graphQLType.name,
  {
    ...graphQLType,
    mapping,
    nested_fields: getNestedFields(mapping),
  },
];

export default addMappingsToTypes;
