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

let appendDot = x => (x ? x + '.' : '');

let mappingToColumnsType = (properties, parent = '', isList = false) => {
  return flattenDeep(
    Object.entries(properties)
      .filter(
        ([field, data]) =>
          ((data.type && data.type !== 'nested') || data.properties) &&
          (data.type !== 'nested' || !parent.match(/hits.edges\[\d*\]/)), // TODO: support double nested fields
      )
      .map(([field, data]) => {
        return data.type !== 'nested'
          ? {
              type: isList ? 'list' : esToColumnType[data.type],
              field: `${appendDot(parent) + field}`,
            }
          : [
              mappingToColumnsType(
                data.properties,
                `${appendDot(parent)}${appendDot(field)}hits.edges[0].node`,
                true,
              ),
              {
                type: 'number',
                field: `${appendDot(parent)}${appendDot(field)}hits.total`,
              },
            ];
      }),
  );
};
export default mappingToColumnsType;
