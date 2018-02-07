import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';

export default ({ aggType, aggProps, title, onValueChange, sqon, path }) => (
  <RangeAgg
    stats={aggProps ? aggProps.stats : null}
    displayName={title}
    handleChange={({ min, max, field }) =>
      onValueChange({
        value: { min, max },
      })
    }
  />
);
