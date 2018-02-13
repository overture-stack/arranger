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
const elasticMappingToDisplayTreeData = (elasticMapping, parentPath) => {
  const mappingKeys = Object.keys(elasticMapping);
  return mappingKeys.map(key => {
    const fieldProps = elasticMapping[key];
    const currentPath = parentPath ? `${parentPath}.${key}` : `${key}`;
    return {
      title: key,
      path: currentPath,
      id: `${key}`,
      ...(fieldProps.properties
        ? {
            children: elasticMappingToDisplayTreeData(
              fieldProps.properties,
              currentPath,
            ),
          }
        : {}),
    };
  });
};

export default { MOCK_MAPPING, elasticMappingToDisplayTreeData };
