import React from 'react';
import { TermAgg, RangeAgg, BooleanAgg, DatesAgg } from '../Aggs';
import { currentFieldValue } from '../SQONView/utils';
import { inCurrentSQON } from '../SQONView/utils';

const composedTermAgg = ({ sqon, onValueChange, ...rest }) => (
  <TermAgg
    handleValueClick={({ generateNextSQON }) => {
      onValueChange({ sqon: generateNextSQON(sqon) });
    }}
    isActive={d =>
      inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon,
      })
    }
    {...rest}
  />
);

const composedRangeAgg = ({ sqon, onValueChange, field, stats, ...rest }) => (
  <RangeAgg
    value={{
      min:
        currentFieldValue({ sqon, dotField: field, op: '>=' }) ||
        stats?.min ||
        0,
      max:
        currentFieldValue({ sqon, dotField: field, op: '<=' }) ||
        stats?.max ||
        0,
    }}
    handleChange={({ generateNextSQON }) =>
      onValueChange({ sqon: generateNextSQON(sqon) })
    }
    {...{ ...rest, stats, field }}
  />
);

const composedBooleanAgg = ({ sqon, onValueChange, ...rest }) => (
  <BooleanAgg
    isActive={d =>
      inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon,
      })
    }
    handleValueClick={({ generateNextSQON }) => {
      onValueChange({ sqon: generateNextSQON(sqon) });
    }}
    {...rest}
  />
);

const composedDatesAgg = ({ sqon, onValueChange, ...rest }) => (
  <DatesAgg
    handleDateChange={({ generateNextSQON = () => {} } = {}) =>
      onValueChange({ sqon: generateNextSQON(sqon) })
    }
    getActiveValue={({ op, field }) =>
      currentFieldValue({
        op,
        dotField: field,
        sqon,
      })
    }
    {...rest}
  />
);

export default {
  keyword: composedTermAgg,
  long: composedRangeAgg,
  float: composedRangeAgg,
  boolean: composedBooleanAgg,
  date: composedDatesAgg,
  integer: composedRangeAgg,
};
