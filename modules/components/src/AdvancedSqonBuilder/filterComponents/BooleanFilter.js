import React from 'react';
import PropTypes from 'prop-types';
import Component from 'react-component-component';
import { get } from 'lodash';

import { getOperationAtPath, setSqonAtPath, IN_OP } from '../utils';
import defaultApi from '../../utils/api';
import { PROJECT_ID } from '../../utils/config';
import BooleanAgg from '../../Aggs/BooleanAgg';
import { FilterContainer } from './common';
import './FilterContainerStyle.css';
import Query from '../../Query';

const getFieldDisplayName = (fieldDisplayNameMap, initialFieldSqon) => {
  return (
    fieldDisplayNameMap[initialFieldSqon.content.field] ||
    initialFieldSqon.content.field
  );
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
    initialSqon = {},
    field,
    fieldDisplayNameMap = {},
    buckets = [],
  } = props;

  const initialState = {
    localSqon: initialSqon,
  };

  const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon) || {
    op: IN_OP,
    content: { field, value: [] },
  };

  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);

  const onSelectionChange = s => ({ value }) => {
    setTimeout(() => {
      const newOp = {
        op: IN_OP,
        content: {
          field,
          value: [value.key_as_string],
        },
      };

      s.setState({
        localSqon: setSqonAtPath(sqonPath, newOp)(s.state.localSqon),
      });
    }, 0);
  };

  const isActive = s => ({ value }) => {
    const op = getOperationAtPath(sqonPath)(s.state.localSqon);
    return value === (op && op.content.value[0]);
  };

  const fieldDisplayName = getFieldDisplayName(
    fieldDisplayNameMap,
    initialFieldSqon,
  );

  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <React.Fragment>
            <div key="header" className="contentSection headerContainer">
              <span>{`${fieldDisplayName}?`}</span>
            </div>
            <div key="body" className="contentSection bodyContainer">
              <BooleanAgg
                WrapperComponent={AggsWrapper}
                field={initialFieldSqon.content.field}
                displayName={fieldDisplayName}
                buckets={buckets}
                defaultDisplayKeys={{
                  true: 'Yes',
                  false: 'No',
                }}
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
  ContainerComponent: PropTypes.func,
  sqonPath: PropTypes.array,
  initialSqon: PropTypes.object,
  field: PropTypes.string.isRequired,
  fieldDisplayNameMap: PropTypes.object,
  buckets: PropTypes.array,
};

export default props => {
  const {
    api = defaultApi,
    arrangerProjectId = PROJECT_ID,
    arrangerProjectIndex,
    initialSqon,
    executableSqon,
    sqonPath,
    field,

    onSubmit,
    onCancel,
    fieldDisplayNameMap,
    opDisplayNameMap,
    ContainerComponent,
  } = props;

  const gqlField = field.split('.').join('__');
  const query = `query($sqon: JSON){
    ${arrangerProjectIndex} {
      aggregations(filters: $sqon) {
        ${gqlField} {
          buckets {
            key
            key_as_string
            doc_count
          }
        }
      }
    }
  }`;
  return (
    <Query
      api={api}
      projectId={arrangerProjectId}
      query={query}
      variables={{ sqon: executableSqon }}
      render={({ data, loading, error }) => (
        <BooleanFilterUI
          ContainerComponent={({ children, ...props }) => (
            <ContainerComponent {...props} loading={loading}>
              {children}
            </ContainerComponent>
          )}
          field={field}
          initialSqon={initialSqon}
          onSubmit={onSubmit}
          onCancel={onCancel}
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
