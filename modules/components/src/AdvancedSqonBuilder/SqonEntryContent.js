import React from 'react';
import {
  resolveSyntheticSqon,
  isReference,
  isBooleanOp,
  isFieldOp,
  isEmptySqon,
  DisplayNameMapContext,
} from './utils';

const PillRemoveButton = ({ onClick }) => (
  <span className={`pillRemoveButton`} onClick={onClick}>
    ✕
  </span>
);

const ValueSelector = ({ value }) => (
  <span className={'valueDisplay'}>
    {Array.isArray(value) ? value.join(', ') : value}
  </span>
);

const FieldOp = ({ sqon: { op, content: { field, value } } }) => (
  <DisplayNameMapContext.Consumer>
    {(fieldDisplayNameMap = {}) => (
      <span className={`fieldOp`}>
        <span className={'opContainer'}>
          <span className={`fieldName`}>
            {fieldDisplayNameMap[field] || field}{' '}
          </span>
          <span className={`opName`}>{op} </span>
        </span>
        <ValueSelector value={value} />
        <PillRemoveButton />
      </span>
    )}
  </DisplayNameMapContext.Consumer>
);

const SqonReference = ({ refIndex }) => <span>{refIndex}</span>;

/**
 * BooleanOp handles nested sqons through recursive rendering.
 * This will be useful for supporting brackets later.
 */
const BooleanOp = ({ sqon: { op, content } }) => (
  <span className={`booleanOp`}>
    {content.map((c, i) => (
      <span key={i}>
        {isBooleanOp(c) ? (
          <span>
            <span>(</span>
            <BooleanOp sqon={c} />
            <span>)</span>
          </span>
        ) : isFieldOp(c) ? (
          <FieldOp sqon={c} />
        ) : isReference(c) ? (
          <SqonReference refIndex={c} />
        ) : isEmptySqon(c) ? (
          <span>oooooo</span>
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
      <div className={`sqonView`}>
        {isBooleanOp(syntheticSqon) && <BooleanOp sqon={compiledSqon} />}
      </div>
    </div>
  );
};
