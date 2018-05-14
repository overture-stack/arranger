import React from "react";
import { TermAgg, RangeAgg, BooleanAgg, DatesAgg } from "../Aggs";
import { currentFieldValue } from "../SQONView/utils";
import { inCurrentSQON } from "../SQONView/utils";
import { fieldInCurrentSQON } from "../SQONView/utils";

const composedTermAgg = ({ sqon, onValueChange, ...rest }) => (
  <TermAgg
    handleValueClick={({ generateNextSQON, value, field }) => {
      onValueChange({
        sqon: generateNextSQON(sqon),
        value: {
          field,
          value,
          active: inCurrentSQON({
            value: value.name,
            field,
            currentSQON: generateNextSQON(sqon)
          })
        }
      });
    }}
    isActive={d =>
      inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon
      })
    }
    {...rest}
  />
);

const composedRangeAgg = ({ sqon, onValueChange, field, stats, ...rest }) => (
  <RangeAgg
    value={{
      min:
        currentFieldValue({ sqon, dotField: field, op: ">=" }) ||
        stats?.min ||
        0,
      max:
        currentFieldValue({ sqon, dotField: field, op: "<=" }) ||
        stats?.max ||
        0
    }}
    handleChange={({
      generateNextSQON,
      field: { displayName, displayUnit, field },
      value
    }) => {
      const nextSQON = generateNextSQON(sqon);

      onValueChange({
        sqon: nextSQON,
        value: {
          field: `${displayName} (${displayUnit})`,
          value,
          active: fieldInCurrentSQON({
            currentSQON: nextSQON.content,
            field: field
          })
        }
      });
    }}
    {...{ ...rest, stats, field }}
  />
);

const composedBooleanAgg = ({ sqon, onValueChange, ...rest }) => (
  <BooleanAgg
    isActive={d =>
      inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon
      })
    }
    handleValueClick={({ generateNextSQON, value, field }) => {
      const nextSQON = generateNextSQON(sqon);
      onValueChange({
        sqon: nextSQON,
        value: {
          value,
          field,
          active: fieldInCurrentSQON({
            currentSQON: nextSQON ? nextSQON.content : [],
            field: field
          })
        }
      });
    }}
    {...rest}
  />
);

const composedDatesAgg = ({ sqon, onValueChange, ...rest }) => (
  <DatesAgg
    handleDateChange={({ generateNextSQON = () => {}, field, value } = {}) => {
      const nextSQON = generateNextSQON(sqon);
      onValueChange({
        sqon: nextSQON,
        value: {
          field,
          value,
          active: fieldInCurrentSQON({
            currentSQON: nextSQON ? nextSQON.content : [],
            field: field
          })
        }
      });
    }}
    getActiveValue={({ op, field }) =>
      currentFieldValue({
        op,
        dotField: field,
        sqon
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
  integer: composedRangeAgg
};
