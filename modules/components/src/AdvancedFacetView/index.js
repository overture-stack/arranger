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
import {
  filterOutNonValue,
  injectExtensionToElasticMapping,
  orderDisplayTreeData,
  filterDisplayTreeDataBySearchTerm,
} from './utils.js';
import TextInput from '../Input';
import SearchIcon from 'react-icons/lib/fa/search';

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

  setSearchTerm = debounce(
    value =>
      this.setState({
        searchTerm: value,
      }),
    500,
  );

  handleSearchboxValueChange = value =>
    this.setState(
      {
        searchBoxDisplayValue: value,
      },
      () => {
        this.setSearchTerm(this.state.searchBoxDisplayValue);
      },
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
                <TextInput
                  icon={<SearchIcon />}
                  className="filterInput"
                  type="text"
                  placeholder="Filter"
                  value={searchBoxDisplayValue || ''}
                  onChange={e =>
                    this.handleSearchboxValueChange(e.target.value)
                  }
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
        </div>
      )
    );
  }
}
