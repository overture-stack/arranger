import React from 'react';
import Component from 'react-component-component';
import BooleanOp from './sqonPieces/BooleanOp';
import { isBooleanOp, removeSqonPath, setSqonAtPath } from './utils';

export default ({
  syntheticSqon,
  allSyntheticSqons = [],
  SqonActionComponent = ({ sqonIndex, isActive, isSelected }) => null,
  onSqonCheckedChange = () => {},
  onSqonDuplicate = () => {},
  onSqonRemove = () => {},
  onSqonChange = sqon => {},
  onDisabledOverlayClick = () => {},
  isActiveSqon = false,
  isSelected = false,
  index = 0,
}) => {
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
        >
          <div className={`activeStateIndicator`} />
          <div className={`selectionContainer`} onClick={onSqonCheckedChange}>
            <input
              readOnly
              type="checkbox"
              checked={isSelected}
              disabled={!isActiveSqon}
            />{' '}
            #{index}
          </div>
          <div style={{ flex: 1 }}>
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
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              pointerEvents: isActiveSqon ? 'none' : 'all',
            }}
            onClick={onDisabledOverlayClick}
          />
          {(isActiveSqon || s.state.hoverring) && (
            <div className={`actionButtonsContainer`}>
              <button className={`button`} onClick={onSqonDuplicate}>
                dup
              </button>
              <button className={`button`} onClick={onSqonRemove}>
                delete
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
