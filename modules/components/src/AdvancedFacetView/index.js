import React from 'react';
import { debounce, keys, isEqual, pick } from 'lodash';
import { css } from '@emotion/react';
import Component from 'react-component-component';
import { FaFilter, FaTimesCircle } from 'react-icons/fa';

import TextInput from '@/Input';
import NestedTreeView from '@/NestedTreeView';
import Spinner from '@/Spinner';
import SQONViewer from '@/SQONViewer';
import Stats from '@/Stats';
import noopFn from '@/utils/noops';

import FacetView from './FacetView';
import {
  filterOutNonValue,
  injectExtensionToElasticMapping,
  orderDisplayTreeData,
  filterDisplayTreeDataBySearchTerm,
} from './utils';
import './AdvancedFacetView.css';

export default class AdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedPath: null,
      withValueOnly: true,
      searchTerm: null,
      displayTreeData: null,
      isLoading: true,
    };
  }
  fieldMappingFromPath = (path) => {
    const { elasticMapping = {} } = this.props;
    return (
      path
        .split('.')
        .reduce(
          (parentNode, nextPath) =>
            parentNode[nextPath]
              ? parentNode[nextPath]
              : parentNode.properties
              ? parentNode.properties[nextPath]
              : {},
          elasticMapping,
        ) || {}
    );
  };
  constructFilterId = ({ fieldName, value }) => (value ? `${fieldName}---${value}` : fieldName);

  handleSqonChange = ({ sqon }) => {
    const { onSqonFieldChange = noopFn } = this.props;
    this.setState({ isLoading: true }, () => onSqonFieldChange({ sqon }));
  };

  getSnapshotBeforeUpdate(prevProps, prevState) {
    const aggChanged = !isEqual(this.props.aggregations, prevProps.aggregations);
    const sqonChanged = !isEqual(this.props.sqon, prevProps.sqon);
    return { shouldEndLoading: aggChanged || sqonChanged };
  }

  componentDidUpdate(prevProps, prevState, { shouldEndLoading }) {
    const shouldRecomputeDisplayTree = !isEqual(
      pick(this.props, ['elasticMapping', 'extendedMapping']),
      pick(prevProps, ['elasticMapping', 'extendedMapping']),
    );
    if (shouldRecomputeDisplayTree) {
      const { rootTypeName, elasticMapping, extendedMapping } = this.props;
      this.setState({
        displayTreeData: orderDisplayTreeData(
          injectExtensionToElasticMapping({
            rootTypeName,
            elasticMapping,
            extendedMapping,
          }),
        ),
      });
    }
    if (shouldEndLoading) {
      this.setState({
        isLoading: false,
      });
    }
  }

  setSearchTerm = debounce((value) => {
    const { onFilterChange = noopFn } = this.props;
    onFilterChange(value);
    this.setState({
      searchTerm: value,
    });
  }, 500);

  render() {
    const { selectedPath, withValueOnly, searchTerm, displayTreeData, isLoading } = this.state;
    const {
      extendedMapping = [],
      aggregations = {},
      sqon,
      statsConfig,
      translateSQONValue,
      onFacetNavigation = noopFn,
      onTermSelected,
      onClear,
      InputComponent = TextInput,
      ...props
    } = this.props;
    const scrollFacetViewToPath = (path) => {
      this.facetView.scrollToPath({ path });
      onFacetNavigation(path);
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
              <SQONViewer
                {...{ sqon, translateSQONValue, onClear }}
                setSQON={(sqon) => this.handleSqonChange({ sqon })}
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
                      <input
                        type="checkBox"
                        checked={withValueOnly}
                        aria-label={`Show only fields with value`}
                      />
                      Show only fields with value
                    </span>
                  </div>
                  <NestedTreeView
                    searchString={searchTerm}
                    defaultCollapsed={({ depth }) => depth !== 0}
                    shouldCollapse={() => {
                      // if there's a searchTerm, expand everything. Else, don't control
                      return searchTerm && searchTerm.length ? false : undefined;
                    }}
                    dataSource={visibleDisplayTreeData}
                    selectedPath={selectedPath}
                    onLeafSelect={(path) => {
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
                      <InputComponent
                        aria-label="Data filter"
                        className="filterInput"
                        leftIcon={{ Icon: FaFilter }}
                        onChange={({ target: { value } }) => {
                          setState({ value }, () => {
                            this.setSearchTerm(value);
                          });
                        }}
                        placeholder="Filter"
                        rightIcon={{
                          Icon: FaTimesCircle,
                          onClick: () => {
                            setState({ value: null }, () => {
                              this.setState({
                                searchTerm: null,
                              });
                            });
                          },
                        }}
                        type="text"
                        value={value || ''}
                      />
                    )}
                  </Component>
                  {statsConfig && (
                    <div
                      className={css`
                        display: flex;
                        flex: 1;
                        height: 100%;
                      `}
                    >
                      <Stats
                        small
                        transparent
                        {...props}
                        {...{ sqon }}
                        stats={statsConfig}
                        className={css`
                          flex-grow: 1;
                        `}
                      />
                    </div>
                  )}
                </div>
                <div className={`facets`}>
                  <FacetView
                    extendedMapping={extendedMapping}
                    constructEntryId={this.constructFilterId}
                    ref={(view) => (this.facetView = view)}
                    sqon={sqon}
                    onValueChange={this.handleSqonChange}
                    aggregations={aggregations}
                    searchString={searchTerm}
                    displayTreeData={filterDisplayTreeDataBySearchTerm({
                      displayTree: visibleDisplayTreeData,
                      aggregations,
                      searchTerm: searchTerm,
                    })}
                    onTermSelected={onTermSelected}
                  />
                </div>
              </div>
            </div>
          </>
        )}
        {isLoading && <Spinner />}
      </div>
    );
  }
}
