import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';

import { currentFieldValue } from '../../SQONView/utils';

export default ({ aggType, aggProps, title, onValueChange, sqon, path }) =>
  aggProps?.stats && (
    <RangeAgg
      stats={aggProps?.stats}
      collapsible={false}
      value={{
        min:
          currentFieldValue({ sqon, dotField: path, op: '>=' }) ||
          aggProps?.stats?.min ||
          0,
        max:
          currentFieldValue({ sqon, dotField: path, op: '<=' }) ||
          aggProps?.stats?.max ||
          0,
      }}
      displayName={title}
      handleChange={({ min, max, field }) =>
        onValueChange({
          value: { min, max },
        })
      }
    />
  );
