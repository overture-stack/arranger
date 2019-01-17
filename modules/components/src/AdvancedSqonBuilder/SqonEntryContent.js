import React from 'react';
import { resolveSyntheticSqon, BOOLEAN_OPS, FIELD_OP } from './utils';
import SqonEntry from './SqonEntry';

const isReference = syntheticSqon => !isNaN(syntheticSqon);

const isValueObj = sqonObj =>
  typeof sqonObj === 'object' && 'value' in sqonObj && 'field' in sqonObj;

const isBooleanOp = sqonObj =>
  typeof sqonObj === 'object' && BOOLEAN_OPS.includes(sqonObj.op);

const isFieldOp = sqonObj =>
  typeof sqonObj === 'object' && FIELD_OP.includes(sqonObj.op);

const BooleanOp = ({ sqon }) => (
  <span>
    {'('}
    {sqon.content.map((c, i) => (
      <span>
        <span>{JSON.stringify(c)}</span>
        {i < sqon.content.length - 1 && <span> {sqon.op} </span>}
      </span>
    ))}
    {')'}
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
