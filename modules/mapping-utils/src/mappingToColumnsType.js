import { flattenDeep } from 'lodash';

export let esToColumnType = {
  string: 'string',
  object: 'string',
  text: 'string',
  boolean: 'boolean',
  date: 'date',
  keyword: 'string',
  id: 'string',
  long: 'number',
  double: 'number',
  integer: 'number',
  float: 'number',
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
