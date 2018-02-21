import React from 'react';
import { keys } from 'lodash';
import mappingUtils from '@arranger/mapping-utils';
import NestedTreeView from '../NestedTreeView';
import SQONView, { Bubble, Field, Op, Value } from '../SQONView';
import './AdvancedFacetView.css';
import FacetView from './FacetView';
import State from '../State';
import { replaceSQON, toggleSQON } from '../SQONView/utils';
import Input from '../Input';
import SearchBox from './SearchBox';
import { filterOutNonValue, injectExtensionToElasticMapping } from './utils.js';

export default class AdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedPath: null,
      withValueOnly: true,
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
                      value: !Array.isArray(value) ? [value] : value,
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
        <SearchBox
          {...{
            withValueOnly,
            elasticMapping,
            extendedMapping,
            aggregations,
            onFieldSelect: field => {
              scrollFacetViewToPath(field);
              this.setState({ selectedPath: field });
            },
          }}
        />
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
                        extendedMapping,
                        displayTreeData,
                        aggregations,
                      }).displayTreeDataWithValue
                    : displayTreeData
                }
                selectedPath={selectedPath}
                onLeafSelect={path => {
                  scrollFacetViewToPath(path);
                  this.setState({ selectedPath: path });
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
