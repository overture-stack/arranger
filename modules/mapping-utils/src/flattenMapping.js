import { flattenDeep } from 'lodash';

let joinWith = (s = '.') => x => (x ? x + s : '');

let flattenMapping = (properties, parent = '') => {
  const output = Object.entries(properties).map(
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
  );
  return output;
};
export default properties => flattenDeep(flattenMapping(properties));
