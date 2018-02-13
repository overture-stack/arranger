import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';

import { currentFieldValue } from '../../SQONView/utils';

export default ({ aggType, aggProps, title, onValueChange, sqon, path }) => (
  <RangeAgg
    stats={aggProps?.stats}
    collapsible={false}
    value={{
      min:
        currentFieldValue({ sqon, dotField: path, op: '>=' }) ||
        aggProps?.stats.min,
      max:
        currentFieldValue({ sqon, dotField: path, op: '<=' }) ||
        aggProps?.stats.max,
    }}
    displayName={title}
    handleChange={({ min, max, field }) =>
      onValueChange({
        value: { min, max },
      })
    }
  />
);
