import React from 'react';
import { keys, debounce, isEqual } from 'lodash';
import { Subject } from 'rxjs';
import { truncate } from 'lodash';
import { css } from 'emotion';
import NestedTreeView from '../NestedTreeView';
import SQONView, { Bubble, Field, Value } from '../SQONView';
import './AdvancedFacetView.css';
import FacetView from './FacetView';
import { replaceSQON, toggleSQON } from '../SQONView/utils';
import SearchBox from './SearchBox';
import {
  filterOutNonValue,
  injectExtensionToElasticMapping,
  orderDisplayTreeData,
} from './utils.js';

export default class AdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    const { elasticMapping, extendedMapping } = props;
    this.state = {
      selectedPath: null,
      withValueOnly: true,
      searchBoxValue: null,
      displayTreeData: null,
    };
  }
  fieldMappingFromPath = path => {
    const { elasticMapping = {} } = this.props;
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
  constructFilterId = ({ field, value }) =>
    value ? `${field}---${value}` : field;

  handleFacetViewValueChange = ({ sqon }) => {
    const { onSqonFieldChange = () => {} } = this.props;
    onSqonFieldChange({ sqon });
  };

  componentWillReceiveProps(nextProps) {
    // use state to cache computation result
    const shouldRecomputeDisplayTree = !isEqual(
      {
        elasticMapping: this.props.elasticMapping,
        extendedMapping: this.props.extendedMapping,
      },
      {
        elasticMapping: nextProps.elasticMapping,
        extendedMapping: nextProps.extendedMapping,
      },
    );
    if (shouldRecomputeDisplayTree) {
      this.setState({
        displayTreeData: orderDisplayTreeData(
          injectExtensionToElasticMapping(
            nextProps.elasticMapping,
            nextProps.extendedMapping,
          ),
        ),
      });
    }
  }

  render() {
    const {
      elasticMapping = {},
      extendedMapping = [],
      aggregations = {},
      sqon,
      onSqonFieldChange = () => {},
      valueCharacterLimit = 30,
    } = this.props;
    const {
      selectedPath,
      withValueOnly,
      searchBoxValue,
      displayTreeData,
    } = this.state;
    const scrollFacetViewToPath = path => {
      this.facetView.scrollToPath({ path });
    };
    return (
      displayTreeData && (
        <div className="advancedFacetViewWrapper">
          <div>
            <SQONView
              sqon={sqon}
              valueCharacterLimit={valueCharacterLimit}
              FieldCrumb={({ field, ...props }) => (
                <Field {...{ field, ...props }}>
                  {extendedMapping.find(e => e.field === field)?.displayName}
                </Field>
              )}
              ValueCrumb={({ value, nextSQON, ...props }) => (
                <Value
                  onClick={() => {
                    onSqonFieldChange({ sqon: nextSQON });
                  }}
                  {...props}
                >
                  {truncate(value, {
                    length: valueCharacterLimit || Infinity,
                  })}
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
              <div className="treeView">
                <div className="panelHeading">
                  <span className="fieldsShown">
                    {withValueOnly
                      ? keys(
                          filterOutNonValue({
                            aggregations,
                          }).aggregationsWithValue,
                        ).length
                      : Object.keys(aggregations).length}{' '}
                    fields
                  </span>
                  <span
                    className="valueOnlyCheck"
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
                <NestedTreeView
                  searchString={searchBoxValue}
                  defaultCollapsed={({ depth }) => depth !== 0}
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
            <div className={`panel facetsPanel`}>
              <div className={`panelHeading`}>
                <SearchBox
                  {...{
                    withValueOnly,
                    elasticMapping,
                    extendedMapping,
                    aggregations,
                    constructEntryId: this.constructFilterId,
                    onValueChange: debounce(
                      ({ value }) =>
                        this.setState({
                          searchBoxValue: value,
                        }),
                      500,
                    ),
                  }}
                />
              </div>
              <div className={`facets`}>
                <FacetView
                  extendedMapping={extendedMapping}
                  valueCharacterLimit={valueCharacterLimit}
                  constructEntryId={this.constructFilterId}
                  ref={view => (this.facetView = view)}
                  sqon={sqon}
                  onValueChange={this.handleFacetViewValueChange}
                  aggregations={aggregations}
                  searchString={searchBoxValue}
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
        </div>
      )
    );
  }
}
