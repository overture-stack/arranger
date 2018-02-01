import React from 'react';
import State from '../State';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import './AdvancedFacetView.css';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

const FacetView = ({ mapping }) => (
  <div>
    mapping:
    <pre>{JSON.stringify(mapping, null, 2)}</pre>
  </div>
);

export default ({ elasticMapping }) => {
  const fieldMappingFromPath = path =>
    path
      .split('.')
      .reduce(
        (parentNode, nextPath) =>
          parentNode[nextPath]
            ? parentNode[nextPath]
            : parentNode.properties ? parentNode.properties[nextPath] : {},
        elasticMapping,
      ) || {};

  return (
    <State
      initial={{
        selectedPath: '',
        selectedMapping: {},
      }}
      render={({ update, selectedPath, selectedMapping }) => (
        <div className="facetViewWrapper">
          <div className="panel treeViewPanel">
            <NestedTreeView
              dataSource={elasticMappingToDisplayTreeData(elasticMapping)}
              selectedPath={selectedPath}
              onLeafSelect={path => {
                update({
                  selectedPath: path,
                  selectedMapping: fieldMappingFromPath(path),
                });
              }}
            />
          </div>
          <div className="panel facetsPanel">
            <FacetView mapping={selectedMapping} />
          </div>
        </div>
      )}
    />
  );
};
