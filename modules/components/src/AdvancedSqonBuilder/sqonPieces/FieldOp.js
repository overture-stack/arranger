import React from 'react';
import Component from 'react-component-component';
import FaChevronDown from 'react-icons/lib/fa/chevron-down';
import FaChevronUp from 'react-icons/lib/fa/chevron-up';
import {
  DisplayNameMapContext,
  getOperationAtPath,
  FIELD_OP_DISPLAY_NAME,
  RANGE_OPS,
  TERM_OPS,
} from '../utils';
import FieldOpModifier from '../filterComponents/index';
import ClickAwayListener from '../../utils/ClickAwayListener.js';
import { PillRemoveButton } from './common';
import { PROJECT_ID } from '../../utils/config';
import defaultApi from '../../utils/api';
import 'react-tippy/dist/tippy.css';
import { Tooltip } from 'react-tippy';
import { isEqual } from 'lodash';
import internalTranslateSQONValue from '../../utils/translateSQONValue';

const formatDisplayValue = raw => {
  if (Array.isArray(raw)) {
    return raw.map(v => internalTranslateSQONValue(v)).join(',');
  }
  return internalTranslateSQONValue(raw);
};

export default props => {
  const {
    onSqonChange = fullSqon => {},
    onContentRemove = () => {},
    fullSyntheticSqon,
    sqonPath = [],
    opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
    arrangerProjectId = PROJECT_ID,
    arrangerProjectIndex,
    FieldOpModifierContainer = undefined,
    api = defaultApi,
    getActiveExecutableSqon,
  } = props;

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
                <span className={`opName`}>{` is ${
                  ((RANGE_OPS.includes(op) || TERM_OPS.includes(op)) && !(isEqual(value,["true"]) || isEqual(value,["false"])))
                    ? opDisplayNameMap[op]
                    : ''
                } `}
                </span>
              </span>
              <ClickAwayListener
                className={'selectionContainer'}
                handler={onClickAway(s)}
              >
                <span className={'valueDisplay'} onClick={toggleDropdown(s)}>
                  <Tooltip
                        position="bottom"
                        html={formatDisplayValue(value)}
                      >
                    {formatDisplayValue(value)}{' '}
                  </Tooltip>
                </span>
                <span onClick={toggleDropdown(s)}>
                  <span style={{ pointerEvents: 'none' }}>
                    {s.state.isOpen ? <FaChevronUp /> : <FaChevronDown />}
                  </span>
                </span>
                {s.state.isOpen && (
                  <div className={`fieldFilterContainer`}>
                    <FieldOpModifier
                      arrangerProjectId={arrangerProjectId}
                      arrangerProjectIndex={arrangerProjectIndex}
                      field={field}
                      sqonPath={sqonPath}
                      initialSqon={fullSyntheticSqon}
                      onSubmit={onNewSqonSubmitted(s)}
                      onCancel={toggleDropdown(s)}
                      fieldDisplayNameMap={fieldDisplayNameMap}
                      opDisplayNameMap={opDisplayNameMap}
                      ContainerComponent={FieldOpModifierContainer}
                      getExecutableSqon={getActiveExecutableSqon}
                      api={api}
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
