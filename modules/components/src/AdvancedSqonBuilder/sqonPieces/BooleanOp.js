import React from 'react';
import Component from 'react-component-component';
import { isReference, isBooleanOp, isFieldOp, isEmptySqon } from '../utils';
import FieldOp from './FieldOp';
import ClickAwayListener from '../../utils/ClickAwayListener.js';
import { PillRemoveButton } from './common';
import { PROJECT_ID } from '../../utils/config';

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

/**
 * BooleanOp handles nested sqons through recursive rendering.
 * This will be useful for supporting brackets later.
 */
const BooleanOp = ({
  arrangerProjectId = PROJECT_ID,
  arrangerProjectIndex,
  contentPath = [],
  onFieldOpRemove = path => {},
  onChange = (changedPath, newOp) => {},
  sqon,
  fullSyntheticSqon = sqon,
  FieldOpModifierContainer = undefined,
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
                <span className="nestedOpBracket">(</span>
                <BooleanOp
                  arrangerProjectId={arrangerProjectId}
                  arrangerProjectIndex={arrangerProjectIndex}
                  sqon={c}
                  fullSyntheticSqon={fullSyntheticSqon}
                  contentPath={currentPath}
                  onFieldOpRemove={onFieldOpRemove}
                  onChange={onChange}
                  FieldOpModifierContainer={FieldOpModifierContainer}
                />
                <span className="nestedOpBracket">)</span>
              </span>
            ) : isFieldOp(c) ? (
              <span>
                <FieldOp
                  arrangerProjectId={arrangerProjectId}
                  arrangerProjectIndex={arrangerProjectIndex}
                  sqonPath={currentPath}
                  fullSyntheticSqon={fullSyntheticSqon}
                  onContentRemove={onRemove(currentPath)}
                  onSqonChange={onNewSqonSubmit}
                  FieldOpModifierContainer={FieldOpModifierContainer}
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
export default BooleanOp;
