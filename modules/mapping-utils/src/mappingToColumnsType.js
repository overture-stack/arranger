import { flattenDeep } from 'lodash';

export let esToColumnType = {
  string: 'string',
  object: 'string',
  nested: 'string',
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
  return Object.entries(properties).map(([field, data]) => {
    return !data.properties
      ? {
          type: isList ? 'list' : esToColumnType[data.type || 'object'],
          field: `${appendDot(parent) + field}`,
        }
      : [
          ...mappingToColumnsType(
            data.properties,
            `${appendDot(parent)}${appendDot(field)}hits.edges[0].node`,
            true,
          ),
          {
            type: 'number',
            field: `${appendDot(parent)}${appendDot(field)}hits.total`,
          },
        ];
  });
};
export default properties => flattenDeep(mappingToColumnsType(properties));
