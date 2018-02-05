import React from 'react';
import State from '../State';
import {
  mappingToDisplayTreeData,
  esToAggTypeMap,
  mappingToAggsState,
} from '@arranger/mapping-utils';
import mappingUtils from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import './AdvancedFacetView.css';
import TermAggs from '../Aggs/TermAgg';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

const esTypeToAggType = esType => esToAggTypeMap[esType];

const AggWrapper = ({ aggType, aggProps, title }) => (
  <div>
    {
      {
        Aggregations: <TermAggs buckets={aggProps ? aggProps.buckets : null} />,
        NumericAggregations: <div>PLACEHOLDER!!!</div>,
      }[aggType]
    }
  </div>
);

const FacetViewNode = ({ title, id, children, path, type, aggregations }) => {
  const esType = type;
  const aggType = esTypeToAggType(esType);
  return (
    <div style={{ marginLeft: 20 }}>
      <div>
        {title}
        <AggWrapper
          title={title}
          aggType={aggType}
          aggProps={aggregations[path]}
        />
      </div>
      {children
        ? children.map(childNode => (
            <FacetViewNode
              key={childNode.path}
              aggregations={aggregations}
              {...childNode}
            />
          ))
        : null}
    </div>
  );
};

const FacetView = ({
  selectedMapping,
  path,
  aggregations,
  disPlayTreeData,
}) => (
  <div>
    {path && `${path}:`}
    <pre>{JSON.stringify(selectedMapping, null, 2)}</pre>
    aggregations:
    {disPlayTreeData.map(node => {
      return (
        <FacetViewNode key={node.path} aggregations={aggregations} {...node} />
      );
    })}
  </div>
);

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
}) => {
  console.log('aggregations: ', aggregations);
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
              selectedMapping={selectedMapping}
              path={selectedPath}
              aggregations={aggregations}
              disPlayTreeData={disPlayTreeData}
            />
          </div>
        </div>
      )}
    />
  );
};
