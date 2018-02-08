import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';

export default ({ aggType, aggProps, title, onValueChange, sqon, path }) => (
  <RangeAgg
    stats={aggProps?.stats}
    value={{
      min: sqon?.content.find(
        content => content.content?.field === path && content.op === '>=',
      )?.content.value,
      max: sqon?.content.find(
        content => content.content?.field === path && content.op === '<=',
      )?.content.value,
    }}
    displayName={title}
    handleChange={({ min, max, field }) =>
      onValueChange({
        value: { min, max },
      })
    }
  />
);
