import React from 'react';
import State from '../State';
import NestedTreeView from '../NestedTreeView';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

export default ({ elasticMapping }) => (
  <State
    initial={{
      selectedPath: null,
    }}
    render={({ update, selectedPath }) => (
      <NestedTreeView
        dataSource={elasticMappingToDisplayTreeData(elasticMapping)}
        onLeafSelect={path => {
          update({ selectedPath: path });
        }}
      />
    )}
  />
);
