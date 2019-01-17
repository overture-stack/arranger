import React from 'react';
import {
  resolveSyntheticSqon,
  isReference,
  isBooleanOp,
  isFieldOp,
} from './utils';

const FieldOp = ({ sqon: { op, content: { field, value } } }) => (
  <span>
    <span>{field} </span>
    <span>{op} </span>
    <span>{Array.isArray(value) ? value.join(', ') : value}</span>
  </span>
);

const SqonReference = ({ refIndex }) => <span>{refIndex}</span>;

/**
 * BooleanOp handles nested sqons through recursive rendering.
 * This will be useful for supporting brackets later.
 */
const BooleanOp = ({ sqon: { op, content } }) => (
  <span>
    {content.map((c, i) => (
      <span>
        {isBooleanOp(c) ? (
          <BooleanOp sqon={c} />
        ) : isFieldOp(c) ? (
          <FieldOp sqon={c} />
        ) : isReference(c) ? (
          <SqonReference refIndex={c} />
        ) : null}
        {i < content.length - 1 && <span> {op} </span>}
      </span>
    ))}
  </span>
);

export default ({ syntheticSqon, allSyntheticSqons = [] }) => {
  const compiledSqon = resolveSyntheticSqon(allSyntheticSqons)(syntheticSqon);
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1 }}>
        {isBooleanOp(syntheticSqon) && <BooleanOp sqon={syntheticSqon} />}
      </div>
    </div>
  );
};
