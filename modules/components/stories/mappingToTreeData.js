import React from 'react';

const MOCK_MAPPING = {
  boolean: {
    type: 'boolean',
  },
  children: {
    properties: {
      key: {
        type: 'text',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
    },
  },
  float: {
    type: 'float',
  },
  int: {
    type: 'long',
  },
  stringarray: {
    type: 'text',
    fields: {
      keyword: {
        type: 'keyword',
        ignore_above: 256,
      },
    },
  },
  text: {
    type: 'text',
    fields: {
      keyword: {
        type: 'keyword',
        ignore_above: 256,
      },
    },
  },
};
const elasticMappingToDisplayTreeData = elasticMapping => {
  const mappingKeys = Object.keys(elasticMapping);
  return mappingKeys.map(key => {
    const fieldProps = elasticMapping[key];
    return {
      title: key,
      id: key,
      [fieldProps.properties && 'children']: fieldProps.properties
        ? elasticMappingToDisplayTreeData(fieldProps.properties)
        : undefined,
    };
  });
};

export { MOCK_MAPPING, elasticMappingToDisplayTreeData };
