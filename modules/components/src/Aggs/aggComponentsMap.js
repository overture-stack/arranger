import { BooleanAgg, DatesAgg, TermAgg, RangeAgg } from '@/Aggs';
import { currentFieldValue, fieldInCurrentSQON, inCurrentSQON } from '@/SQONViewer/utils';

const composedTermAgg = ({ sqon, onValueChange, getTermAggProps = () => ({}), ...rest }) => (
  <TermAgg
    handleValueClick={({ generateNextSQON, value, fieldName }) => {
      let nextSQON = generateNextSQON(sqon);
      const active = fieldInCurrentSQON({
        currentSQON: nextSQON?.content || [],
        fieldName,
      });
      onValueChange({
        sqon: nextSQON,
        value: {
          fieldName,
          value,
          active,
        },
      });
    }}
    isActive={(d) =>
      inCurrentSQON({
        value: d.value,
        dotFieldName: d.fieldName,
        currentSQON: sqon,
      })
    }
    {...{ ...rest, ...getTermAggProps() }}
  />
);

const composedRangeAgg = ({
  sqon,
  onValueChange,
  fieldName,
  stats,
  getRangeAggProps = () => ({}),
  ...rest
}) => (
  <RangeAgg
    sqonValues={
      !!sqon && {
        min: currentFieldValue({ sqon, dotFieldName: fieldName, op: '>=' }),
        max: currentFieldValue({ sqon, dotFieldName: fieldName, op: '<=' }),
      }
    }
    handleChange={({
      generateNextSQON,
      fieldName: { displayName, displayUnit, fieldName },
      value,
    }) => {
      const nextSQON = generateNextSQON(sqon);

      onValueChange({
        sqon: nextSQON,
        value: {
          fieldName: `${displayName} (${displayUnit})`,
          value,
          active: fieldInCurrentSQON({
            currentSQON: nextSQON?.content,
            fieldName,
          }),
        },
      });
    }}
    {...{ ...rest, stats, fieldName, ...getRangeAggProps() }}
  />
);

const composedBooleanAgg = ({
  sqon,
  onValueChange,
  componentProps,
  getBooleanAggProps = () => ({}),
  ...rest
}) => (
  <BooleanAgg
    isActive={(d) =>
      inCurrentSQON({
        value: d.value,
        dotFieldName: d.fieldName,
        currentSQON: sqon,
      })
    }
    handleValueClick={({ generateNextSQON, value, fieldName }) => {
      const nextSQON = generateNextSQON(sqon);
      onValueChange({
        sqon: nextSQON,
        value: {
          value,
          fieldName,
          active: fieldInCurrentSQON({
            currentSQON: nextSQON ? nextSQON.content : [],
            fieldName,
          }),
        },
      });
    }}
    {...{ ...rest, ...getBooleanAggProps() }}
  />
);

const composedDatesAgg = ({ sqon, onValueChange, getDatesAggProps = () => ({}), ...rest }) => (
  <DatesAgg
    handleDateChange={({ generateNextSQON = () => {}, fieldName, value } = {}) => {
      const nextSQON = generateNextSQON(sqon);
      onValueChange({
        sqon: nextSQON,
        value: {
          fieldName,
          value,
          active: fieldInCurrentSQON({
            currentSQON: nextSQON ? nextSQON.content : [],
            fieldName,
          }),
        },
      });
    }}
    getActiveValue={({ op, fieldName }) =>
      currentFieldValue({
        op,
        dotFieldName: fieldName,
        sqon,
      })
    }
    {...{ ...rest, ...getDatesAggProps() }}
  />
);

export default {
  boolean: composedBooleanAgg,
  byte: composedRangeAgg,
  date: composedDatesAgg,
  float: composedRangeAgg,
  half_float: composedRangeAgg,
  integer: composedRangeAgg,
  keyword: composedTermAgg,
  long: composedRangeAgg,
  scaled_float: composedRangeAgg,
  unsigned_long: composedRangeAgg,
};
