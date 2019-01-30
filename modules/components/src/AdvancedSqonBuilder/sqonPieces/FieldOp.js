import React from 'react';
import Component from 'react-component-component';
import {
  DisplayNameMapContext,
  getOperationAtPath,
  FIELD_OP_DISPLAY_NAME,
} from '../utils';
import { TermFilter, RangeFilter } from '../filterComponents/index';
import ClickAwayListener from '../../utils/ClickAwayListener.js';
import { PillRemoveButton } from './common';
import ExtendedMappingProvider from '../../utils/ExtendedMappingProvider';
import { default as defaultApi } from '../../utils/api';

const mockExtendedMapping = [
  {
    field: 'participants.diagnoses.diagnosis_category',
    type: 'keyword',
  },
  {
    field: 'participants.phenotype.hpo_phenotype_observed_text',
    type: 'keyword',
  },
  {
    field: 'participants.study.short_name',
    type: 'keyword',
  },
  {
    field: 'kf_id',
    type: 'keyword',
  },
  {
    field: 'some_numeric_field',
    type: 'integer',
  },
  {
    field: 'some_other_numeric_field',
    type: 'integer',
  },
  {
    field: 'another_numeric_field',
    type: 'integer',
  },
];

const FieldOpModifier = ({
  sqonPath,
  initialSqon,
  onSubmit,
  onCancel,
  fieldDisplayNameMap,
  opDisplayNameMap,
  ContainerComponent = undefined,
  api = defaultApi,
  projectId = 'june_13',
  graphqlField = 'file',
  field,
}) => (
  <ExtendedMappingProvider
    api={api}
    projectId={projectId}
    graphqlField={graphqlField}
  >
    {({ loading, extendedMapping }) => {
      const fieldExtendedMapping = (mockExtendedMapping || []).find(
        ({ field: _field }) => field === _field,
      );
      const { type } = fieldExtendedMapping || {};
      return type === 'keyword' ? (
        <TermFilter
          loading={loading}
          sqonPath={sqonPath}
          initialSqon={initialSqon}
          onSubmit={onSubmit}
          onCancel={onCancel}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          ContainerComponent={ContainerComponent}
        />
      ) : ['long', 'float', 'integer'].includes(type) ? (
        <RangeFilter
          loading={loading}
          sqonPath={sqonPath}
          initialSqon={initialSqon}
          onSubmit={onSubmit}
          onCancel={onCancel}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          ContainerComponent={ContainerComponent}
        />
      ) : (
        <div>oops, something is wrong</div>
      );
    }}
  </ExtendedMappingProvider>
);

export default ({
  onSqonChange = fullSqon => {},
  onContentRemove = () => {},
  fullSyntheticSqon,
  sqonPath = [],
  opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
}) => {
  const fieldOpObj = getOperationAtPath(sqonPath)(fullSyntheticSqon);
  const { op, content: { field, value } } = fieldOpObj;
  const initialState = { isOpen: false };
  const onClickAway = s => () => {
    s.setState({ isOpen: false });
  };
  const toggleDropdown = s => () => s.setState({ isOpen: !s.state.isOpen });
  const onRemoveClick = () => {
    onContentRemove(fieldOpObj);
  };
  const onNewSqonSubmitted = s => newSqon => {
    onSqonChange(newSqon);
    toggleDropdown(s)();
  };
  return (
    <Component initialState={initialState}>
      {s => (
        <DisplayNameMapContext.Consumer>
          {(fieldDisplayNameMap = {}) => (
            <span className={`fieldOp pill`}>
              <span className={'opContainer'}>
                <span className={`fieldName`}>
                  {fieldDisplayNameMap[field] || field}{' '}
                </span>
                <span className={`opName`}> is {opDisplayNameMap[op]} </span>
              </span>
              <ClickAwayListener
                className={'selectionContainer'}
                handler={onClickAway(s)}
              >
                <span className={'valueDisplay'} onClick={toggleDropdown(s)}>
                  {Array.isArray(value) ? value.join(', ') : value}{' '}
                </span>
                <span
                  onClick={toggleDropdown(s)}
                  className={`fa fa-chevron-${s.state.isOpen ? 'up' : 'down'}`}
                />
                {s.state.isOpen && (
                  <div className={`fieldFilterContainer`}>
                    <FieldOpModifier
                      field={field}
                      sqonPath={sqonPath}
                      initialSqon={fullSyntheticSqon}
                      onSubmit={onNewSqonSubmitted(s)}
                      onCancel={toggleDropdown(s)}
                      fieldDisplayNameMap={fieldDisplayNameMap}
                      opDisplayNameMap={opDisplayNameMap}
                    />
                  </div>
                )}
              </ClickAwayListener>
              <PillRemoveButton onClick={onRemoveClick} />
            </span>
          )}
        </DisplayNameMapContext.Consumer>
      )}
    </Component>
  );
};
