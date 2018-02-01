import React from 'react';
import State from '../State';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import './AdvancedFacetView.css';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

export default ({ elasticMapping }) => (
  <State
    initial={{
      selectedPath: '',
    }}
    render={({ update, selectedPath }) => (
      <div className="facetViewWrapper">
        <div className="treeViewPanel">
          <NestedTreeView
            dataSource={elasticMappingToDisplayTreeData(elasticMapping)}
            selectedPath={selectedPath}
            onLeafSelect={path => {
              update({ selectedPath: path });
            }}
          />
        </div>
        <div className="facetsPanel" />
      </div>
    )}
  />
);
