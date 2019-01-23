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
  changeSqonOpAtPath,
} from './utils';
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

const ValueSelector = ({ value }) => (
  <span className={'valueDisplay'}>
    {Array.isArray(value) ? value.join(', ') : value}
  </span>
);

const LogicalOpSelector = ({ opName, onChange = newOpName => {} }) => {
  const initialState = { isOpen: false };
  const selectionOptions = ['and', 'or'];
  const onClickAway = s => () => {
    s.setState({ isOpen: false });
  };
  const onClick = s => () => {
    s.setState({ isOpen: !s.state.isOpen });
  };
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

const FieldOp = ({ onContentRemove = () => {}, sqon }) => {
  const {
    op,
    content: { field, value },
  } = sqon;
  const onRemoveClick = () => {
    onContentRemove(sqon);
  };
  return (
    <DisplayNameMapContext.Consumer>
      {(fieldDisplayNameMap = {}) => (
        <span className={`fieldOp pill`}>
          <span className={'opContainer'}>
            <span className={`fieldName`}>
              {fieldDisplayNameMap[field] || field}{' '}
            </span>
            <span className={`opName`}>{op} </span>
          </span>
          <ValueSelector value={value} />
          <PillRemoveButton onClick={onRemoveClick} />
        </span>
      )}
    </DisplayNameMapContext.Consumer>
  );
};

/**
 * BooleanOp handles nested sqons through recursive rendering.
 * This will be useful for supporting brackets later.
 */
const BooleanOp = ({
  contentPath = [],
  onFieldOpRemove = path => {},
  onChange = (changedPath, newOpName) => {},
  sqon: { op, content },
}) => {
  const onRemove = path => () => onFieldOpRemove(path);
  const onOpChange = newOp => onChange(contentPath, newOp);
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
                  contentPath={currentPath}
                  onFieldOpRemove={onFieldOpRemove}
                  onChange={onChange}
                />
                <span>)</span>
              </span>
            ) : isFieldOp(c) ? (
              <span>
                <FieldOp sqon={c} onContentRemove={onRemove(currentPath)} />
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
  const onLogicalOpChanged = (changedPath, newOpName) =>
    onSqonChange(changeSqonOpAtPath(changedPath, newOpName)(syntheticSqon));
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
