import { flattenDeep } from 'lodash';

let getNestedFields = (mapping, parent = '') => {
  return Object.entries(mapping)
    .filter(([, metadata]) => metadata.properties)
    .map(([field, metadata]) => [
      parent ? `${parent}.${field}` : field,
      ...getNestedFields(
        metadata.properties,
        parent ? `${parent}.${field}` : field,
      ),
    ]);
};

export default mapping => flattenDeep(getNestedFields(mapping));
