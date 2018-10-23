import { flattenDeep } from 'lodash';

let joinWith = (s = '.') => x => (x ? x + s : '');

let flattenMapping = (properties, parent = '') => {
  return flattenDeep(
    Object.entries(properties).map(
      ([field, data]) =>
        !data.properties
          ? data.fields
            ? [
                {
                  field: joinWith()(parent) + field,
                  type: field.includes('id') ? 'id' : data.type,
                },
                ...Object.entries(data.fields).map(([subField, data]) => ({
                  field: joinWith()(joinWith()(parent) + field) + subField,
                  type: 'analyzed',
                })),
              ]
            : {
                field: joinWith()(parent) + field,
                type: field.includes('id') ? 'id' : data.type,
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
};
export default flattenMapping;
