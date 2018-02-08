import React from 'react';
import { keys } from 'lodash';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import mappingUtils from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import SQONView from '../SQONView';
import './AdvancedFacetView.css';
import FacetView from './FacetView';
import State from '../State';

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

const filterOutNonValue = ({ aggregations, displayTreeData }) => {
  const aggregationsWithValue = keys(aggregations).reduce(
    (a, key) => ({
      ...a,
      ...(() => {
        const keyHasValue =
          aggregations[key].buckets?.length > 0 ||
          aggregations[key].stats?.min ||
          aggregations[key].stats?.max;
        return keyHasValue ? { [key]: aggregations[key] } : {};
      })(),
    }),
    {},
  );
  const keysWithValue = keys(aggregationsWithValue);
  const doesDisplayNodeHaveValue = node => {
    return node.children
      ? node.children.filter(doesDisplayNodeHaveValue).length
      : keysWithValue.indexOf(node.path) > -1;
  };
  const applyFilterToDisplayNodeCollection = collection =>
    collection.filter(doesDisplayNodeHaveValue).map(
      node =>
        node.children
          ? {
              ...node,
              children: applyFilterToDisplayNodeCollection(node.children),
            }
          : node,
    );
  if (displayTreeData) {
    const displayTreeDataWithValue = applyFilterToDisplayNodeCollection(
      displayTreeData,
    );
    return { displayTreeDataWithValue, aggregationsWithValue };
  } else {
    return { aggregationsWithValue };
  }
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
  const displayTreeData = injectExtensionToElasticMapping(
    elasticMapping,
    extendedMapping,
  );
  return (
    <State
      initial={{
        selectedPath: '',
        selectedMapping: {},
        withValueOnly: false,
      }}
      render={({ update, selectedPath, selectedMapping, withValueOnly }) => (
        <div className="advancedFacetViewWrapper">
          <div>
            <SQONView sqon={sqon} />
          </div>
          <div className="facetViewWrapper">
            <div className="panel treeViewPanel">
              <div className="panelHeading">
                {withValueOnly
                  ? keys(
                      filterOutNonValue({
                        aggregations,
                      }).aggregationsWithValue,
                    ).length
                  : Object.keys(aggregations).length}{' '}
                fields
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    update({
                      selectedPath: displayTreeData[0]?.path,
                      withValueOnly: !withValueOnly,
                    })
                  }
                >
                  <input type="checkBox" checked={withValueOnly} />
                  Show only fields with value
                </span>
              </div>
              <div className="treeView">
                <NestedTreeView
                  dataSource={
                    withValueOnly
                      ? filterOutNonValue({
                          displayTreeData,
                          aggregations,
                        }).displayTreeDataWithValue
                      : displayTreeData
                  }
                  selectedPath={selectedPath}
                  onLeafSelect={path => {
                    update({
                      selectedPath: path,
                      selectedMapping: fieldMappingFromPath(path),
                    });
                  }}
                />
              </div>
            </div>
            <div className="panel facetsPanel">
              <FacetView
                sqon={sqon}
                onValueChange={({ value, path, esType, aggType }) =>
                  onSqonFieldChange({ value, path, esType, aggType })
                }
                onUserScroll={({ topPath }) =>
                  update({ selectedPath: topPath })
                }
                selectedMapping={selectedMapping}
                path={selectedPath}
                aggregations={aggregations}
                displayTreeData={
                  withValueOnly
                    ? filterOutNonValue({
                        displayTreeData,
                        aggregations,
                      }).displayTreeDataWithValue
                    : displayTreeData
                }
              />
            </div>
          </div>
        </div>
      )}
    />
  );
};
