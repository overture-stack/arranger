import React from 'react';
import { keys, orderBy } from 'lodash';
import { Subject } from 'rxjs';
import { truncate } from 'lodash';
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

const orderDisplayTreeData = displayTreeData => {
  const setWithChildrenOrdered = displayTreeData.map(
    ({ children, ...rest }) => ({
      ...rest,
      ...(children
        ? {
            children: orderDisplayTreeData(children),
          }
        : {}),
    }),
  );
  return [
    ...orderBy(
      setWithChildrenOrdered.filter(({ children }) => !children),
      'title',
    ),
    ...orderBy(
      setWithChildrenOrdered.filter(({ children }) => children),
      'title',
    ),
  ];
};

export default class AdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedPath: null,
      withValueOnly: true,
      searchBoxValue: null,
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
  render() {
    const {
      elasticMapping = {},
      extendedMapping = [],
      aggregations = {},
      sqon,
      onSqonFieldChange = () => {},
      valueCharacterLimit = 30,
    } = this.props;
    const { selectedPath, withValueOnly, searchBoxValue } = this.state;
    const displayTreeData = orderDisplayTreeData(
      injectExtensionToElasticMapping(elasticMapping, extendedMapping),
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
    const searchBoxSelection$ = new Subject();
    return (
      <div className="advancedFacetViewWrapper">
        <SearchBox
          {...{
            withValueOnly,
            elasticMapping,
            extendedMapping,
            aggregations,
            constructEntryId: this.constructFilterId,
            onValueChange: ({ value }) =>
              this.setState({
                searchBoxValue: value,
              }),
            onFieldSelect: ({ field, value }) => {
              scrollFacetViewToPath(field);
              this.setState({ selectedPath: field });
              searchBoxSelection$.next({ field, value });
            },
          }}
        />
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
            <div className="treeView">
              <NestedTreeView
                searchString={searchBoxValue}
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
              valueCharacterLimit={valueCharacterLimit}
              searchboxSelectionObservable={searchBoxSelection$}
              constructEntryId={this.constructFilterId}
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
