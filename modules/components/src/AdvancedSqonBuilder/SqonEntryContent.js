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

const FieldOp = ({ onContentRemove = () => {}, sqon }) => {
  const { op, content: { field, value } } = sqon;
  const onRemoveClick = () => {
    onContentRemove(sqon);
  };
  return (
    <DisplayNameMapContext.Consumer>
      {(fieldDisplayNameMap = {}) => (
        <span className={`fieldOp pill`}>
          <span className={'opContainer'}>
            <span className={`fieldName`}>
              {fieldDisplayNameMap[field] || field}{' '}
            </span>
            <span className={`opName`}>{op} </span>
          </span>
          <ValueSelector value={value} />
          <PillRemoveButton onClick={onRemoveClick} />
        </span>
      )}
    </DisplayNameMapContext.Consumer>
  );
};

const SqonReference = ({ refIndex, onRemoveClick = () => {} }) => (
  <span className={`sqonReference pill`}>
    <span className={'sqonReferenceIndex'}>#{refIndex}</span>
    <PillRemoveButton onClick={onRemoveClick} />
  </span>
);

/**
 * BooleanOp handles nested sqons through recursive rendering.
 * This will be useful for supporting brackets later.
 */
const BooleanOp = ({
  contentPath = [],
  onFieldOpRemove = path => {},
  sqon: { op, content },
}) => {
  const onRemove = path => () => onFieldOpRemove(path);
  return (
    <span className={`booleanOp`}>
      {content.map((c, i) => {
        const currentPath = [...contentPath, i];
        return (
          <span key={i}>
            {isBooleanOp(c) ? (
              <span>
                <span>(</span>
                <BooleanOp
                  sqon={c}
                  contentPath={currentPath}
                  onFieldOpRemove={onFieldOpRemove}
                />
                <span>)</span>
              </span>
            ) : isFieldOp(c) ? (
              <span>
                <FieldOp sqon={c} onContentRemove={onRemove(currentPath)} />
              </span>
            ) : isReference(c) ? (
              <SqonReference
                refIndex={c}
                onRemoveClick={onRemove(currentPath)}
              />
            ) : isEmptySqon(c) ? (
              <span>oooooo</span>
            ) : null}
            {i < content.length - 1 && <span> {op} </span>}
          </span>
        );
      })}
    </span>
  );
};

export default ({ syntheticSqon, onFieldOpRemove, allSyntheticSqons = [] }) => {
  const compiledSqon = resolveSyntheticSqon(allSyntheticSqons)(syntheticSqon);
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div className={`sqonView`}>
        {isBooleanOp(syntheticSqon) && (
          <BooleanOp
            index={0}
            onFieldOpRemove={onFieldOpRemove}
            sqon={syntheticSqon}
          />
        )}
      </div>
    </div>
  );
};
