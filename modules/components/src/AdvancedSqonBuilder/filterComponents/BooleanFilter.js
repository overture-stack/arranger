import React from 'react';
import PropTypes from 'prop-types';
import Component from 'react-component-component';

import {
  getOperationAtPath,
} from '../utils';
import BooleanAgg from '../../Aggs/BooleanAgg';
import { FilterContainer } from './common';
import './FilterContainerStyle.css';

const getFieldDisplayName = (fieldDisplayNameMap, initialFieldSqon) => {
  return fieldDisplayNameMap[initialFieldSqon.content.field] || initialFieldSqon.content.field;
};

const AggsWrapper = ({ children }) => (
  <div className="aggregation-card">{children}</div>
);

export const BooleanFilterUI = props => {
  const {
    onSubmit = sqon => {},
    onCancel = () => {},
    ContainerComponent = FilterContainer,
    sqonPath = [],
    initialSqon = null,
    field = '',
    fieldDisplayNameMap = {},
  } = props;

  const initialState = {
    selectedValue: undefined,
    localSqon: initialSqon
  };

  const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon) || {
    op: 'and',
    content: { value: initialState.selectedValue, field },
  };

  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);

  const onSelectionChange = s => ({ value, generateNextSQON }) => {
    s.setState({
      selectedValue: value.key_as_string,
      localSqon: generateNextSQON(s.state.localSqon),
    });
  };

  const isActive = s => ({ value }) => value === s.state.selectedValue;

  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <React.Fragment>
            <div key="header" className="contentSection">
              <span>
                { `Participant is a ${getFieldDisplayName(fieldDisplayNameMap, initialFieldSqon)}`}
              </span>
            </div>
            <div key="body" className="contentSection meowContainer">
              <BooleanAgg
                WrapperComponent={AggsWrapper}
                field={initialFieldSqon.content.field}
                displayName="Is Proband"
                // TODO JB - use real data for the buckets
                buckets={[
                  {
                    key: '0',
                    doc_count: 2580,
                    key_as_string: 'false',
                  },
                  {
                    key: '1',
                    doc_count: 961,
                    key_as_string: 'true',
                  },
                ]}
                handleValueClick={onSelectionChange(s)}
                isActive={isActive(s)}
              />
            </div>
          </React.Fragment>
        </ContainerComponent>
      )}
    </Component>
  );
};

BooleanFilterUI.propTypes = {
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
};
