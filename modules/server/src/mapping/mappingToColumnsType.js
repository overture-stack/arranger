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
    Object.entries(properties).map(([fieldName, data]) => {
      return !data.properties
        ? {
            type: isList ? 'list' : esToColumnType[data.type],
            fieldName: `${appendDot(parent) + fieldName}`,
          }
        : [
            mappingToColumnsType(
              data.properties,
              `${appendDot(parent)}${
                data.type === 'nested' ? `${appendDot(fieldName)}hits.edges[0].node` : fieldName
              }`,
              data.type === 'nested' || isList,
            ),
            ...(data.type === 'nested'
              ? [
                  {
                    type: 'number',
                    fieldName: `${appendDot(parent)}${appendDot(fieldName)}hits.total`,
                  },
                ]
              : []),
          ];
    }),
  );
};
export default mappingToColumnsType;
