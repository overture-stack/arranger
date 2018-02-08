import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';

export default ({ aggType, aggProps, title, onValueChange, sqon, path }) => (
  <RangeAgg
    stats={aggProps?.stats}
    collapsible={false}
    value={{
      min:
        sqon?.content.find(
          content => content.content?.field === path && content.op === '>=',
        )?.content.value || aggProps?.stats.min,
      max:
        sqon?.content.find(
          content => content.content?.field === path && content.op === '<=',
        )?.content.value || aggProps?.stats.max,
    }}
    displayName={title}
    handleChange={({ min, max, field }) =>
      onValueChange({
        value: { min, max },
      })
    }
  />
);
