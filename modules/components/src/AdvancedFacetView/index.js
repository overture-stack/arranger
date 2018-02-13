import React from 'react';
import { keys } from 'lodash';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import mappingUtils from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import SQONView, { Bubble, Field, Op, Value } from '../SQONView';
import './AdvancedFacetView.css';
import FacetView from './FacetView';
import State from '../State';
import { replaceSQON, toggleSQON } from '../SQONView/utils';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

const injectExtensionToElasticMapping = (elasticMapping, extendedMapping) => {
  const rawDisplayData = elasticMappingToDisplayTreeData(elasticMapping);
  const extend = node => {
    const extension = extendedMapping.find(
      extension => extension.field === node.path,
    );
    return {
      ...node,
      ...(extension
        ? {
            title: extension.displayName || node.title,
            type: extension.type || node.title,
          }
        : {}),
      ...(node.children ? { children: node.children.map(extend) } : {}),
    };
  };
  return rawDisplayData.map(extend);
};

const filterOutNonValue = ({ aggregations, displayTreeData }) => {
  const aggregationsWithValue = keys(aggregations).reduce((a, key) => {
    const keyHasValue =
      aggregations[key].buckets?.length > 0 ||
      aggregations[key].stats?.min ||
      aggregations[key].stats?.max;
    return {
      ...a,
      ...(keyHasValue ? { [key]: aggregations[key] } : {}),
    };
  }, {});
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

export default class AdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedPath: null,
      withValueOnly: false,
    };
  }
  fieldMappingFromPath = path => {
    const {
      elasticMapping = {},
      extendedMapping = [],
      aggregations = {},
      sqon = {},
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
      sqon,
      onSqonFieldChange = () => {},
    } = this.props;
    const { selectedPath, withValueOnly } = this.state;
    const displayTreeData = injectExtensionToElasticMapping(
      elasticMapping,
      extendedMapping,
    );
    const scrollFacetViewToPath = path => {
      this.facetView.scrollToPath(path);
    };
    const handleFacetViewValueChange = ({ value, path, esType, aggType }) => {
      const { sqon } = this.props;
      const newSQON = (() => {
        switch (aggType) {
          case 'Aggregations':
            return toggleSQON(
              {
                op: 'and',
                content: [
                  {
                    op: 'in',
                    content: {
                      field: path,
                      value: value,
                    },
                  },
                ],
              },
              sqon,
            );
          case 'NumericAggregations':
            return replaceSQON(
              {
                op: 'and',
                content: [
                  {
                    op: '>=',
                    content: { field: path, value: value.min },
                  },
                  {
                    op: '<=',
                    content: { field: path, value: value.max },
                  },
                ],
              },
              sqon,
            );
          default:
            return sqon;
        }
      })();
      onSqonFieldChange({ sqon: newSQON });
    };
    return (
      <div className="advancedFacetViewWrapper">
        <div>
          <SQONView
            sqon={sqon}
            ValueCrumb={({ value, nextSQON, ...props }) => (
              <Value
                onClick={() => {
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
                  onSqonFieldChange({ sqon: nextSQON });
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
                  this.setState({
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
                  this.setState({
                    selectedPath: path,
                  });
                }}
              />
            </div>
          </div>
          <div className="panel facetsPanel">
            <FacetView
              ref={view => (this.facetView = view)}
              sqon={sqon}
              onValueChange={handleFacetViewValueChange}
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
    );
  }
}
