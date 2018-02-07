import React from 'react';
import State from '../State';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import mappingUtils from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import SQONView from '../SQONView';
import './AdvancedFacetView.css';
import FacetView from './FacetView';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

const injectExtensionToElasticMapping = (elasticMapping, extendedMapping) => {
  const rawDisplayData = elasticMappingToDisplayTreeData(elasticMapping);
  const replaceNodeDisplayName = node => {
    const extension = extendedMapping.find(
      extension => extension.field === node.path,
    );
    return {
      ...node,
      title: extension ? extension.displayName : node.title,
      ...(node.children
        ? { children: node.children.map(replaceNodeDisplayName) }
        : {}),
      ...(extension
        ? {
            type: extension.type || node.title,
          }
        : {}),
    };
  };
  return rawDisplayData.map(replaceNodeDisplayName);
};

export default ({
  elasticMapping = {},
  extendedMapping = [],
  aggregations = {},
  sqon = {},
  onSqonFieldChange = () => {},
}) => {
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
  const disPlayTreeData = injectExtensionToElasticMapping(
    elasticMapping,
    extendedMapping,
  );
  return (
    <State
      initial={{
        selectedPath: '',
        selectedMapping: {},
      }}
      render={({ update, selectedPath, selectedMapping }) => (
        <div className="advancedFacetViewWrapper">
          <div>
            <SQONView sqon={sqon} />
          </div>
          <div className="facetViewWrapper">
            <div className="panel treeViewPanel">
              <NestedTreeView
                dataSource={disPlayTreeData}
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
              <FacetView
                sqon={sqon}
                onValueChange={({ value, path, esType, aggType }) =>
                  onSqonFieldChange({ value, path, esType, aggType })
                }
                selectedMapping={selectedMapping}
                path={selectedPath}
                aggregations={aggregations}
                disPlayTreeData={disPlayTreeData}
              />
            </div>
          </div>
        </div>
      )}
    />
  );
};
