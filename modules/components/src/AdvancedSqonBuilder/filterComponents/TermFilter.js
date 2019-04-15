import React from 'react';
import Component from 'react-component-component';
import { sortBy, get } from 'lodash';

import './FilterContainerStyle.css';
import { FilterContainer } from './common';
import {
  getOperationAtPath,
  setSqonAtPath,
  FIELD_OP_DISPLAY_NAME,
  TERM_OPS,
  IN_OP,
  AND_OP,
} from '../utils';
import TermAgg from '../../Aggs/TermAgg';
import TextFilter from '../../TextFilter';
import { inCurrentSQON } from '../../SQONView/utils';
import defaultApi from '../../utils/api';
import { PROJECT_ID } from '../../utils/config';
import Query from '../../Query';

const AggsWrapper = ({ children }) => (
  <div className="aggregation-card">{children}</div>
);

const filterStringsCaseInsensitive = (values, searchString, path = null) =>
  values.filter(val => {
    const valText = path ? get(val, path) : val;
    return -1 !== valText.search(new RegExp(searchString, 'i'));
  });

export const TermFilterUI = props => {
  const {
    initialSqon = null,
    onSubmit = sqon => {},
    onCancel = () => {},
    ContainerComponent = FilterContainer,
    InputComponent = TextFilter,
    sqonPath = [],
    buckets,
    fieldDisplayNameMap = {},
    opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
    field,
  } = props;

  const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon) || {
    op: IN_OP,
    content: { value: [], field },
  };
  const initialState = { searchString: '', localSqon: initialSqon };
  const onSearchChange = s => e => {
    s.setState({ searchString: e.value });
  };
  const isFilterActive = s => d =>
    inCurrentSQON({
      value: d.value,
      dotField: d.field,
      currentSQON: getOperationAtPath(sqonPath)(s.state.localSqon),
    });
  const getCurrentFieldOp = s =>
    getOperationAtPath(sqonPath)(s.state.localSqon);
  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);
  const computeBuckets = (s, buckets) =>
    sortBy(
      filterStringsCaseInsensitive(buckets, s.state.searchString, 'key'),
      bucket =>
        !inCurrentSQON({
          value: bucket.key,
          dotField: initialFieldSqon.content.field,
          currentSQON: getOperationAtPath(sqonPath)(initialSqon),
        }),
    );
  const onOptionTypeChange = s => e => {
    const currentFieldSqon = getCurrentFieldOp(s);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        op: e.target.value,
      })(s.state.localSqon),
    });
  };
  const onSelectAllClick = s => () => {
    const currentFieldSqon = getCurrentFieldOp(s);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: filterStringsCaseInsensitive(
            buckets.map(({ key }) => key),
            s.state.searchString,
          ),
        },
      })(s.state.localSqon),
    });
  };
  const onClearClick = s => () => {
    const currentFieldSqon = getCurrentFieldOp(s);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [],
        },
      })(s.state.localSqon),
    });
  };
  const onFilterClick = s => ({ generateNextSQON }) => {
    setTimeout(() => {
      // state change in the same tick somehow results in this component dismounting (probably  something to do with TermAgg's click event, needs investigation)
      const deltaSqon = generateNextSQON();
      const deltaFiterObjContentValue = deltaSqon.content[0].content.value;
      // we're only interested in the new field operation's content value
      const currentFieldSqon = getCurrentFieldOp(s);
      const existingValue = (currentFieldSqon.content.value || []).find(v =>
        deltaFiterObjContentValue.includes(v),
      );
      const newFieldSqon = {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [
            ...(currentFieldSqon.content.value || []).filter(
              v => v !== existingValue,
            ),
            ...(existingValue ? [] : deltaFiterObjContentValue),
          ],
        },
      };
      s.setState({
        localSqon: setSqonAtPath(sqonPath, newFieldSqon)(s.state.localSqon),
      });
    }, 0);
  };
  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <div className="contentSection">
            <span>
              {fieldDisplayNameMap[initialFieldSqon.content.field] ||
                initialFieldSqon.content.field}
            </span>{' '}
            is{' '}
            <span className="select">
              <select
                onChange={onOptionTypeChange(s)}
                value={getCurrentFieldOp(s).op}
              >
                {TERM_OPS.map(option => (
                  <option key={option} value={option}>
                    {opDisplayNameMap[option]}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="contentSection searchInputContainer">
            <InputComponent
              value={s.state.searchString}
              onChange={onSearchChange(s)}
            />
          </div>
          <div className="contentSection termFilterActionContainer">
            <span
              className={`aggsFilterAction selectAll`}
              onClick={onSelectAllClick(s)}
            >
              Select All
            </span>
            <span
              className={`aggsFilterAction clear`}
              onClick={onClearClick(s)}
            >
              Clear
            </span>
          </div>
          <div className="contentSection termAggContainer">
            <TermAgg
              WrapperComponent={AggsWrapper}
              field={initialFieldSqon.content.field}
              displayName="Disease Type"
              buckets={computeBuckets(s, buckets)}
              handleValueClick={onFilterClick(s)}
              isActive={isFilterActive(s)}
              maxTerms={5}
            />
          </div>
        </ContainerComponent>
      )}
    </Component>
  );
};

export default props => {
  const {
    field,
    arrangerProjectId = PROJECT_ID,
    arrangerProjectIndex,
    api = defaultApi,
    executableSqon = {
      op: AND_OP,
      content: [],
    },

    initialSqon = null,
    onSubmit = sqon => {},
    onCancel = () => {},
    ContainerComponent = FilterContainer,
    InputComponent = TextFilter,
    sqonPath = [],
    fieldDisplayNameMap = {},
    opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
  } = props;

  const gqlField = field.split('.').join('__');
  const query = `query($sqon: JSON){
    ${arrangerProjectIndex} {
      aggregations(filters: $sqon) {
        ${gqlField} {
          buckets {
            key
            doc_count
          }
        }
      }
    }
  }`;
  return (
    <Query
      variables={{ sqon: executableSqon }}
      projectId={arrangerProjectId}
      api={api}
      query={query}
      render={({ data, loading, error }) => (
        <TermFilterUI
          ContainerComponent={({ children, ...props }) => (
            <ContainerComponent {...props} loading={loading}>
              {children}
            </ContainerComponent>
          )}
          field={field}
          initialSqon={initialSqon}
          onSubmit={onSubmit}
          onCancel={onCancel}
          InputComponent={InputComponent}
          sqonPath={sqonPath}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          buckets={
            data
              ? get(
                  data,
                  `${arrangerProjectIndex}.aggregations.${gqlField}.buckets`,
                )
              : []
          }
        />
      )}
    />
  );
};
