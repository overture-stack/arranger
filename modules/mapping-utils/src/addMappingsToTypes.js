import getNestedFields from './getNestedFields';

let addMappingsToTypes = ({ types, mappings }) => {
  console.log('types: ', types);
  console.log('mappings: ', mappings);
  return types.filter((x, i) => mappings[i]).map(([key, type], i) => {
    let mapping = Object.values(mappings[i] || {})[0]?.mappings[type.es_type]
      ?.properties;

    return [
      key,
      {
        ...type,
        mapping,
        nested_fields: getNestedFields(mapping),
      },
    ];
  });
};

export default addMappingsToTypes;
