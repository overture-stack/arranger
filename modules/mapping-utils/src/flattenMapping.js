import { flattenDeep } from 'lodash';

let joinWith = (s = '.') => x => (x ? x + s : '');

let flattenMapping = (properties, parent = '') => {
  return flattenDeep(
    Object.entries(properties)
      .filter(
        ([field, data]) =>
          (data.type && data.type !== 'nested') || data.properties,
      )
      .map(
        ([field, data]) =>
          data.type && data.type !== 'nested'
            ? {
                field: joinWith()(parent) + field,
                type: data.type,
              }
            : mappingToAggsType(data.properties, joinWith()(parent) + field),
      ),
  );
};
export default flattenMapping;
