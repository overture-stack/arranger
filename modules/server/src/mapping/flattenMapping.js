import { flattenDeep } from 'lodash';

let joinWith =
  (s = '.') =>
  (x) =>
    x ? x + s : '';

const flattenMapping = (properties, parent = '') => {
  return flattenDeep(
    Object.entries(properties).map(([fieldName, data]) =>
      !data.properties
        ? {
            fieldName: joinWith()(parent) + fieldName,
            type: data.type,
          }
        : [
            {
              fieldName: joinWith()(parent) + fieldName,
              type: data.type || 'object',
            },
            ...flattenMapping(data.properties, joinWith()(parent) + fieldName),
          ],
    ),
  );
};

export default flattenMapping;
