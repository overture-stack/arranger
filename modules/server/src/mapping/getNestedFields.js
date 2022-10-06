import { flattenDeep } from 'lodash';

const getNestedFields = (mapping, parent = '') => {
  return flattenDeep(
    Object.entries(mapping || {}).map(([fieldName, metadata]) => {
      const fullPath = parent ? `${parent}.${fieldName}` : fieldName;
      return [
        metadata.type === 'nested' && fullPath,
        ...getNestedFields(metadata.properties, fullPath),
      ];
    }),
  ).filter(Boolean);
};

export default getNestedFields;
