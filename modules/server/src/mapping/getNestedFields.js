import { flattenDeep } from 'lodash';

let getNestedFields = (mapping, parent = '') => {
  return flattenDeep(
    Object.entries(mapping || {}).map(([field, metadata]) => {
      const fullPath = parent ? `${parent}.${field}` : field;
      return [
        metadata.type === 'nested' && fullPath,
        ...getNestedFields(metadata.properties, fullPath),
      ];
    }),
  ).filter(Boolean);
};

export default getNestedFields;
