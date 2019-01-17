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

const BooleanOp = ({ sqon: { op, content } }) => (
  <span>
    {content.map((c, i) => (
      <span>
        {isFieldOp(c) ? (
          <FieldOp sqon={c} />
        ) : isBooleanOp(c) ? (
          <BooleanOp sqon={c} />
        ) : isReference ? (
          <SqonReference refIndex={c} />
        ) : null}
        {i < content.length - 1 && <span> {op} </span>}
      </span>
    ))}
  </span>
);

const SqonEntryContent = ({ syntheticSqon, allSyntheticSqons = [] }) => {
  const compiledSqon = resolveSyntheticSqon(allSyntheticSqons)(syntheticSqon);
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1 }}>
        {isBooleanOp(syntheticSqon) && <BooleanOp sqon={syntheticSqon} />}
      </div>
    </div>
  );
};

export default SqonEntryContent;
