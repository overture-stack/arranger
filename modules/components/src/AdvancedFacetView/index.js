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

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

const esTypeToAggType = esType => esToAggTypeMap[esType];

const NumericAggSection = () => <div>aggs</div>;

const AggWrapper = ({ aggType, props }) => (
  <div>
    {
      {
        Aggregations: <NumericAggSection {...props} />,
        NumericAggregations: <NumericAggSection {...props} />,
      }[aggType]
    }
  </div>
);

const FacetViewNode = ({ title, id, children, path, type, aggProps }) => {
  const esType = type;
  const aggType = esTypeToAggType(esType);
  return (
    <div style={{ marginLeft: 20, borderLeft: 'solid 2px red' }}>
      <div>
        {title}
        <AggWrapper aggType={aggType} props={aggProps} />
      </div>
      {children
        ? children.map(childNode => (
            <FacetViewNode key={childNode.path} {...childNode} />
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
      return <FacetViewNode key={node.path} {...node} />;
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
