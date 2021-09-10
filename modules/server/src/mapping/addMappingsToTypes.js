import getNestedFields from './getNestedFields';

let addMappingsToTypes = ({ types, mappings }) => {
  return types
    .filter((x, i) => mappings[i])
    .map(([key, type], i) => {
      let mapping = Object.values(mappings[i] || {})[0]?.mappings?.properties;

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
