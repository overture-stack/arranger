import React from 'react';
import SqonEntryContent from './SqonEntryContent';

export default ({
  syntheticSqon,
  allSyntheticSqons = [],
  SqonActionComponent = ({ sqonIndex, isActive, isSelected }) => null,
  onSqonCheckedChange = () => {},
  onSqonDuplicate = () => {},
  onSqonRemove = () => {},
  onDisabledOverlayClick = () => {},
  isActiveSqon = false,
  isSelected = false,
  index = 0,
  onFieldOpRemove = (sqonPath = []) => {},
}) => (
  <div className={`sqonEntry ${isActiveSqon ? 'active' : ''}`}>
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
      <SqonEntryContent
        syntheticSqon={syntheticSqon}
        allSyntheticSqons={allSyntheticSqons}
        onFieldOpRemove={onFieldOpRemove}
      />
    </div>
    <div>
      <button disabled={!isActiveSqon} onClick={onSqonDuplicate}>
        dup
      </button>
      <button disabled={!isActiveSqon} onClick={onSqonRemove}>
        delete
      </button>
      <SqonActionComponent sqonIndex={index} isActive={isActiveSqon} />
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
  </div>
);
