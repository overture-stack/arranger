import { flattenDeep } from 'lodash';

let joinWith = (s = '.') => x => (x ? x + s : '');

let flattenMapping = (properties, parent = '') =>
  flattenDeep(
    Object.entries(properties).map(
      ([field, data]) =>
        !data.properties
          ? {
              field: joinWith()(parent) + field,
              type: data.type,
            }
          : [
              {
                field: joinWith()(parent) + field,
                type: data.type || 'object',
              },
              ...flattenMapping(data.properties, joinWith()(parent) + field),
            ],
    ),
  );
export default flattenMapping;
