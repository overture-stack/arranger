import React from 'react';
import { isBooleanOp, removeSqonPath, setSqonAtPath } from '../utils';
import BooleanOp from './BooleanOp';

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
