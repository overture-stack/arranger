import React from 'react';
import Component from 'react-component-component';
import FaRegClone from 'react-icons/lib/fa/clone';
import FaTrashAlt from 'react-icons/lib/fa/trash';
import BooleanOp from './sqonPieces/BooleanOp';
import { isBooleanOp, removeSqonPath, setSqonAtPath } from './utils';
import { PROJECT_ID } from '../utils/config';
import defaultApi from '../utils/api';

export default ({
  arrangerProjectId = PROJECT_ID,
  arrangerProjectIndex,
  syntheticSqon,
  getActiveExecutableSqon,
  SqonActionComponent = ({ sqonIndex, isActive, isSelected }) => null,
  onSqonCheckedChange = () => {},
  onSqonDuplicate = () => {},
  onSqonRemove = () => {},
  onSqonChange = sqon => {},
  onActivate = () => {},
  isActiveSqon = false,
  isSelected = false,
  index = 0,
  FieldOpModifierContainer = undefined,
  api = defaultApi,
  disabled = false,
  getColorForReference = index => '',
  isReferenced = false,
  isIndexReferenced = index => false,
}) => {
  const referenceColor = getColorForReference(index);
  const initialState = {
    hoverring: false,
  };
  const hoverStart = s => e => {
    s.setState({
      hoverring: true,
    });
  };
  const hoverEnd = s => e => {
    s.setState({
      hoverring: false,
    });
  };
  const onFieldOpRemove = removedPath =>
    onSqonChange(removeSqonPath(removedPath)(syntheticSqon));
  const onLogicalOpChanged = (changedPath, newSqon) =>
    onSqonChange(setSqonAtPath(changedPath, newSqon)(syntheticSqon));
  return (
    <Component initialState={initialState}>
      {s => (
        <div
          onMouseEnter={hoverStart(s)}
          onMouseLeave={hoverEnd(s)}
          className={`sqonEntry ${isActiveSqon ? 'active' : ''}`}
          onClick={onActivate}
        >
          <div
            className={`activeStateIndicator`}
            style={
              !isReferenced
                ? {}
                : {
                    background: referenceColor,
                  }
            }
          />
          <div className={`selectionContainer`} onClick={onSqonCheckedChange}>
            <input
              readOnly
              type="checkbox"
              checked={isSelected}
              disabled={disabled}
            />{' '}
            #{index + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <div className={`sqonView`}>
                {isBooleanOp(syntheticSqon) && (
                  <BooleanOp
                    arrangerProjectId={arrangerProjectId}
                    arrangerProjectIndex={arrangerProjectIndex}
                    index={0}
                    onFieldOpRemove={onFieldOpRemove}
                    onChange={onLogicalOpChanged}
                    sqon={syntheticSqon}
                    FieldOpModifierContainer={FieldOpModifierContainer}
                    api={api}
                    getActiveExecutableSqon={getActiveExecutableSqon}
                    getColorForReference={getColorForReference}
                    isIndexReferenced={isIndexReferenced}
                    referencesShouldHighlight={isActiveSqon}
                  />
                )}
              </div>
            </div>
          </div>
          {(isActiveSqon || s.state.hoverring) && (
            <div className={`actionButtonsContainer`}>
              <button
                className={`sqonListActionButton`}
                disabled={disabled}
                onClick={onSqonDuplicate}
              >
                <FaRegClone />
              </button>
              <button className={`sqonListActionButton`} onClick={onSqonRemove}>
                <FaTrashAlt />
              </button>
            </div>
          )}
          <SqonActionComponent
            isHoverring={s.state.hoverring}
            sqonIndex={index}
            isActive={isActiveSqon}
            isSelected={isSelected}
          />
        </div>
      )}
    </Component>
  );
};
