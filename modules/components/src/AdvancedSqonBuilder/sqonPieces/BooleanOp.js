import React from 'react';
import Component from 'react-component-component';
import FaChevronDown from 'react-icons/lib/fa/chevron-down';
import FaChevronUp from 'react-icons/lib/fa/chevron-up';
import { isReference, isBooleanOp, isFieldOp, isEmptySqon } from '../utils';
import FieldOp from './FieldOp';
import ClickAwayListener from '../../utils/ClickAwayListener.js';
import { PillRemoveButton } from './common';
import { PROJECT_ID } from '../../utils/config';
import defaultApi from '../../utils/api';

const SqonReference = props => {
  const {
    refIndex,
    onRemoveClick = () => {},
    highlightColor,
    isHighlighted,
  } = props;
  return (
    <span className={`sqonReference pill`}>
      <span
        className={'content sqonReferenceIndex'}
        style={
          !isHighlighted
            ? {}
            : {
                background: highlightColor,
              }
        }
      >
        #{refIndex + 1}
      </span>
      <PillRemoveButton onClick={onRemoveClick} />
    </span>
  );
};

const LogicalOpSelector = props => {
  const { opName, onChange = newOpName => {} } = props;
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
          <span
            className="pill logicalOpSelector"
            role="button"
            tabIndex={0}
            onClick={onClick(s)}
            onKeyPress={onClick(s)}
          >
            <span className={'content'} style={{ pointerEvents: 'none' }}>
              <span className={'opName'}>{opName}</span>{' '}
              {s.state.isOpen ? <FaChevronUp /> : <FaChevronDown />}
            </span>
            {s.state.isOpen && (
              <div className={`menuContainer`}>
                {selectionOptions.map(option => (
                  <div
                    key={option}
                    className="menuOption"
                    onClick={onselect(option)}
                    onKeyPress={onselect(option)}
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
const BooleanOp = props => {
  const {
    arrangerProjectId = PROJECT_ID,
    arrangerProjectIndex,
    contentPath = [],
    onFieldOpRemove = path => {},
    onChange = (changedPath, newOp) => {},
    sqon,
    fullSyntheticSqon = sqon,
    FieldOpModifierContainer = undefined,
    api = defaultApi,
    getActiveExecutableSqon,
    getColorForReference = () => '',
    isIndexReferenced = () => false,
    referencesShouldHighlight = false,
  } = props;
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
                  {...props}
                  sqon={c}
                  fullSyntheticSqon={fullSyntheticSqon}
                  contentPath={currentPath}
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
                  api={api}
                  getActiveExecutableSqon={getActiveExecutableSqon}
                />
              </span>
            ) : isReference(c) ? (
              <SqonReference
                refIndex={c}
                onRemoveClick={onRemove(currentPath)}
                highlightColor={getColorForReference(c)}
                isHighlighted={
                  referencesShouldHighlight && isIndexReferenced(c)
                }
              />
            ) : isEmptySqon(c) ? (
              <span>empty sqon is not yet supported here</span>
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
