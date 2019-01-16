import React from 'react';

export default ({
  sqon,
  SqonActionComponent = ({ sqon, isActive, isSelected }) => null,
  onSqonCheckedChange = () => {},
  onSqonDuplicate = () => {},
  onSqonRemove = () => {},
  onDisabledOverlayClick = () => {},
  isActiveSqon = false,
  isSelected = false,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      position: 'relative',
      background: !isActiveSqon ? 'lightgrey' : 'white',
    }}
  >
    <div onClick={onSqonCheckedChange}>
      <input readOnly type="checkbox" checked={isSelected} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1 }}>{JSON.stringify(sqon)}</div>
      </div>
    </div>
    <div>
      <button disabled={!isActiveSqon} onClick={onSqonDuplicate}>
        dup
      </button>
      <button disabled={!isActiveSqon} onClick={onSqonRemove}>
        delete
      </button>
      <SqonActionComponent sqon={sqon} isActive={isActiveSqon} />
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
