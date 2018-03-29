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
import Input from '../Input';
import Component from 'react-component-component';
import {
  filterOutNonValue,
  injectExtensionToElasticMapping,
  orderDisplayTreeData,
  filterDisplayTreeDataBySearchTerm,
} from './utils.js';
import TextInput from '../Input';
import SearchIcon from 'react-icons/lib/fa/search';
import Spinner from 'react-spinkit';

const spinner = (
  <Spinner
    fadeIn="none"
    name="circle"
    color="#a9adc0"
    style={{
      width: 30,
      height: 30,
    }}
  />
);

export default class AdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    const { elasticMapping, extendedMapping } = props;
    this.state = {
      selectedPath: null,
      withValueOnly: true,
      searchTerm: null,
      displayTreeData: null,
      searchBoxDisplayValue: '',
      isLoading: true,
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

  handleSqonChange = ({ sqon }) => {
    const { onSqonFieldChange = () => {} } = this.props;
    this.setState(
      {
        isLoading: true,
      },
      () => {
        onSqonFieldChange({ sqon });
      },
    );
  };

  getSnapshotBeforeUpdate(prevProps, prevState) {
    const aggChanged = !isEqual(
      this.props.aggregations,
      prevProps.aggregations,
    );
    const sqonChanged = !isEqual(this.props.sqon, prevProps.sqon);
    return {
      shouldEndLoading: aggChanged || sqonChanged,
    };
  }

  componentDidUpdate(prevProps, prevState, { shouldEndLoading }) {
    const shouldRecomputeDisplayTree = !isEqual(
      {
        elasticMapping: this.props.elasticMapping,
        extendedMapping: this.props.extendedMapping,
      },
      {
        elasticMapping: prevProps.elasticMapping,
        extendedMapping: prevProps.extendedMapping,
      },
    );
    if (shouldRecomputeDisplayTree) {
      this.setState({
        displayTreeData: orderDisplayTreeData(
          injectExtensionToElasticMapping(
            this.props.elasticMapping,
            this.props.extendedMapping,
          ),
        ),
      });
    }
    if (shouldEndLoading) {
      this.setState({
        isLoading: false,
      });
    }
  }

  setSearchTerm = debounce(
    value =>
      this.setState({
        searchTerm: value,
      }),
    500,
  );

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
      searchTerm,
      displayTreeData,
      searchBoxDisplayValue,
      isLoading,
    } = this.state;
    const scrollFacetViewToPath = path => {
      this.facetView.scrollToPath({ path });
    };
    const visibleDisplayTreeData = withValueOnly
      ? filterOutNonValue({
          extendedMapping,
          displayTreeData,
          aggregations,
        }).displayTreeDataWithValue
      : displayTreeData;

    return (
      <div className="advancedFacetViewWrapper">
        {displayTreeData && (
          <>
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
                      this.handleSqonChange({ sqon: nextSQON });
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
                      this.handleSqonChange({ sqon: nextSQON });
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
                    searchString={searchTerm}
                    defaultCollapsed={({ depth }) => depth !== 0}
                    dataSource={visibleDisplayTreeData}
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
                  {/* using a thin local state here for rendering performance optimization */}
                  <Component initialState={{ value: searchTerm || '' }}>
                    {({ state: { value }, setState }) => (
                      <TextInput
                        icon={<SearchIcon />}
                        className="filterInput"
                        type="text"
                        placeholder="Filter"
                        value={value}
                        onChange={e => {
                          const value = e.target.value;
                          setState({ value }, () => {
                            this.setSearchTerm(value);
                          });
                        }}
                      />
                    )}
                  </Component>
                </div>
                <div className={`facets`}>
                  <FacetView
                    extendedMapping={extendedMapping}
                    valueCharacterLimit={valueCharacterLimit}
                    constructEntryId={this.constructFilterId}
                    ref={view => (this.facetView = view)}
                    sqon={sqon}
                    onValueChange={this.handleSqonChange}
                    aggregations={aggregations}
                    searchString={searchTerm}
                    displayTreeData={filterDisplayTreeDataBySearchTerm({
                      displayTree: visibleDisplayTreeData,
                      aggregations,
                      searchTerm: searchTerm,
                    })}
                  />
                </div>
              </div>
            </div>
          </>
        )}
        {isLoading && (
          <div
            className={`loadingScreen ${css`
              position: absolute;
              left: 0px;
              right: 0px;
              top: 0px;
              bottom: 0px;
              display: flex;
              justify-content: center;
              align-items: center;
            `}`}
          >
            {spinner}
          </div>
        )}
      </div>
    );
  }
}
