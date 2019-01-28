import React from 'react';
import Component from 'react-component-component';
import { DisplayNameMapContext, getOperationAtPath } from '../utils';
import TermFilter from '../filterComponents/TermFilter';
import ClickAwayListener from '../../utils/ClickAwayListener.js';
import { PillRemoveButton } from './common';

export default ({
  onSqonChange = fullSqon => {},
  onContentRemove = () => {},
  fullSyntheticSqon,
  sqonPath = [],
}) => {
  const fieldOpObj = getOperationAtPath(sqonPath)(fullSyntheticSqon);
  const {
    op,
    content: { field, value },
  } = fieldOpObj;
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
                <span className={`opName`}>{op} </span>
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
                    <TermFilter
                      sqonPath={sqonPath}
                      initialSqon={fullSyntheticSqon}
                      onSubmit={onNewSqonSubmitted(s)}
                      onCancel={toggleDropdown(s)}
                      fieldDisplayNameMap={fieldDisplayNameMap}
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
