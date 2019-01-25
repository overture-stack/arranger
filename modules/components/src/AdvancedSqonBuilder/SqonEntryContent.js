import React from 'react';
import Component from 'react-component-component';
import {
  resolveSyntheticSqon,
  isReference,
  isBooleanOp,
  isFieldOp,
  isEmptySqon,
  DisplayNameMapContext,
  removeSqonPath,
  setSqonAtPath,
  getOperationAtPath,
} from './utils';
import FieldFilter from './FieldFilter';
import ClickAwayListener from '../utils/ClickAwayListener.js';

const PillRemoveButton = ({ onClick }) => (
  <span className={`pillRemoveButton`} onClick={onClick}>
    ✕
  </span>
);

const SqonReference = ({ refIndex, onRemoveClick = () => {} }) => (
  <span className={`sqonReference pill`}>
    <span className={'content sqonReferenceIndex'}>#{refIndex}</span>
    <PillRemoveButton onClick={onRemoveClick} />
  </span>
);

const LogicalOpSelector = ({ opName, onChange = newOpName => {} }) => {
  const initialState = { isOpen: false };
  const selectionOptions = ['and', 'or'];
  const onClickAway = s => () => {
    s.setState({ isOpen: false });
  };
  const onClick = s => () => s.setState({ isOpen: !s.state.isOpen });
  const onselect = option => () => onChange(option);
  return (
    <Component initialState={initialState}>
      {s => (
        <ClickAwayListener handler={onClickAway(s)}>
          <span className={'pill logicalOpSelector'} onClick={onClick(s)}>
            <span className={'content'}>
              {opName}{' '}
              <span
                className={`fa fa-chevron-${s.state.isOpen ? 'up' : 'down'}`}
              />
            </span>
            {s.state.isOpen && (
              <div className={`menuContainer`}>
                {selectionOptions.map(option => (
                  <div
                    key={option}
                    onClick={onselect(option)}
                    className={`menuOption`}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </span>
        </ClickAwayListener>
      )}
    </Component>
  );
};

const FieldOp = ({
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
                    <FieldFilter
                      sqonPath={sqonPath}
                      initialSqon={fullSyntheticSqon}
                      onSubmit={onNewSqonSubmitted(s)}
                      onCancel={toggleDropdown(s)}
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

/**
 * BooleanOp handles nested sqons through recursive rendering.
 * This will be useful for supporting brackets later.
 */
const BooleanOp = ({
  contentPath = [],
  onFieldOpRemove = path => {},
  onChange = (changedPath, newOp) => {},
  sqon,
  fullSyntheticSqon = sqon,
}) => {
  const { op, content } = sqon;
  const onOpChange = newOpName =>
    onChange(contentPath, {
      op: newOpName,
      content,
    });
  const onNewSqonSubmit = newSqon => onChange([], newSqon); // FieldOp dispatches a full sqon on change
  const onRemove = path => () => onFieldOpRemove(path);
  return (
    <span className={`booleanOp`}>
      {content.map((c, i) => {
        const currentPath = [...contentPath, i];
        return (
          <span key={i}>
            {isBooleanOp(c) ? (
              <span>
                <span>(</span>
                <BooleanOp
                  sqon={c}
                  fullSyntheticSqon={fullSyntheticSqon}
                  contentPath={currentPath}
                  onFieldOpRemove={onFieldOpRemove}
                  onChange={onChange}
                />
                <span>)</span>
              </span>
            ) : isFieldOp(c) ? (
              <span>
                <FieldOp
                  sqonPath={currentPath}
                  fullSyntheticSqon={fullSyntheticSqon}
                  onContentRemove={onRemove(currentPath)}
                  onSqonChange={onNewSqonSubmit}
                />
              </span>
            ) : isReference(c) ? (
              <SqonReference
                refIndex={c}
                onRemoveClick={onRemove(currentPath)}
              />
            ) : isEmptySqon(c) ? (
              <span>oooooo</span>
            ) : null}
            {i < content.length - 1 && (
              <LogicalOpSelector opName={op} onChange={onOpChange} />
            )}
          </span>
        );
      })}
    </span>
  );
};

export default ({ syntheticSqon, onSqonChange, allSyntheticSqons = [] }) => {
  const onFieldOpRemove = removedPath =>
    onSqonChange(removeSqonPath(removedPath)(syntheticSqon));
  const onLogicalOpChanged = (changedPath, newSqon) =>
    onSqonChange(setSqonAtPath(changedPath, newSqon)(syntheticSqon));
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div className={`sqonView`}>
        {isBooleanOp(syntheticSqon) && (
          <BooleanOp
            index={0}
            onFieldOpRemove={onFieldOpRemove}
            onChange={onLogicalOpChanged}
            sqon={syntheticSqon}
          />
        )}
      </div>
    </div>
  );
};
