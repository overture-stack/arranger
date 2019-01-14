import React from 'react';
import SQONView from '../SQONView';

const BOOLEAN_OPS = ['and', 'or', 'not'];

const FIELD_OP = ['in', 'gte', 'lte'];

export default ({
  sqons,
  activeSqonIndex,
  SqonActionComponent = ({ sqon }) => null,
}) => (
  <div>
    {sqons.map((sqon, i) => (
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1 }}>
          <SingleSqonBuilder sqon={sqon} isActive={activeSqonIndex === i} />
        </div>
        <div>
          <SqonActionComponent sqon={sqon} />
        </div>
      </div>
    ))}
  </div>
);

const SingleSqonBuilder = ({ sqon, selected, index, isActive = false }) => {
  return (
    <div>
      <div>
        <input type="checkbox" checked={selected} />
      </div>
      <div>
        <SQONView sqon={sqon} />
      </div>
    </div>
  );
};
