import React from 'react';
import { keys } from 'lodash';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import mappingUtils from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import SQONView, { Bubble, Field, Op, Value } from '../SQONView';
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

const emptySQON = {
  op: 'and',
  content: [],
};

const serializeToDomId = path => path.split('.').join('__');
const serializeDomIdToPath = path => path.split('.').join('__');

export default class AdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
  }
  fieldMappingFromPath = path => {
    const {
      elasticMapping = {},
      extendedMapping = [],
      aggregations = {},
      sqon = {},
      onSqonFieldChange = () => {},
    } = this.props;
    return (
      path
        .split('.')
        .reduce(
          (parentNode, nextPath) =>
            parentNode[nextPath]
              ? parentNode[nextPath]
              : parentNode.properties ? parentNode.properties[nextPath] : {},
          elasticMapping,
        ) || {}
    );
  };
  render() {
    const {
      elasticMapping = {},
      extendedMapping = [],
      aggregations = {},
      sqon = {},
      onSqonFieldChange = () => {},
    } = this.props;
    const displayTreeData = injectExtensionToElasticMapping(
      elasticMapping,
      extendedMapping,
    );
    const scrollFacetViewToPath = path => {
      const targetElementId = serializeToDomId(path);
      const targetElement = this.facetView.root.querySelector(
        `#${targetElementId}`,
      );
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    };
    return (
      <State
        initial={{
          selectedPath: '',
          withValueOnly: false,
          localSQON: emptySQON,
        }}
        render={({ update, selectedPath, withValueOnly, localSQON }) => (
          <div className="advancedFacetViewWrapper">
            <div>
              <SQONView
                sqon={sqon || localSQON}
                ValueCrumb={({ value, nextSQON, ...props }) => (
                  <Value
                    onClick={() => {
                      update({ localSQON: nextSQON });
                      onSqonFieldChange({ sqon: nextSQON });
                    }}
                    {...props}
                  >
                    {value}
                  </Value>
                )}
                Clear={({ nextSQON }) => (
                  <Bubble
                    className="sqon-clear"
                    onClick={() => {
                      update({ localSQON: emptySQON });
                      onSqonFieldChange({ sqon: emptySQON });
                    }}
                  >
                    Clear
                  </Bubble>
                )}
              />
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
                      scrollFacetViewToPath(path);
                      update({
                        selectedPath: path,
                      });
                    }}
                  />
                </div>
              </div>
              <div className="panel facetsPanel">
                <FacetView
                  ref={view => (this.facetView = view)}
                  sqon={sqon || localSQON}
                  onValueChange={({ value, path, esType, aggType }) =>
                    onSqonFieldChange({ value, path, esType, aggType })
                  }
                  onUserScroll={e => update({ selectedPath: null })}
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
  }
}
