import React from 'react';
import State from '../State';
import NestedTreeView from '../NestedTreeView';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

export default ({ elasticMapping }) => (
  <State
    initial={{
      selectedPath: '',
    }}
    render={({ update, selectedPath }) => (
      <NestedTreeView
        dataSource={elasticMappingToDisplayTreeData(elasticMapping)}
        selectedPath={selectedPath}
        onLeafSelect={path => {
          update({ selectedPath: path });
        }}
      />
    )}
  />
);
