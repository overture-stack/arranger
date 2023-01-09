import { flattenDeep } from 'lodash';

export let esToColumnType = {
  boolean: 'boolean',
  byte: 'number',
  date: 'date',
  double: 'number',
  float: 'number',
  half_float: 'number',
  id: 'string',
  integer: 'number',
  keyword: 'string',
  long: 'number',
  object: 'string',
  scaled_float: 'number',
  string: 'string',
  text: 'string',
  unsigned_long: 'number',
};

let appendDot = (x) => (x ? x + '.' : '');

let mappingToColumnsType = (properties, parent = '', isList = false) => {
  return flattenDeep(
    Object.entries(properties).map(([field, data]) => {
      return !data.properties
        ? {
            type: isList ? 'list' : esToColumnType[data.type],
            field: `${appendDot(parent) + field}`,
          }
        : [
            mappingToColumnsType(
              data.properties,
              `${appendDot(parent)}${
                data.type === 'nested' ? `${appendDot(field)}hits.edges[0].node` : field
              }`,
              data.type === 'nested' || isList,
            ),
            ...(data.type === 'nested'
              ? [
                  {
                    type: 'number',
                    field: `${appendDot(parent)}${appendDot(field)}hits.total`,
                  },
                ]
              : []),
          ];
    }),
  );
};
export default mappingToColumnsType;
