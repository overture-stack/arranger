import { BooleanAgg, DatesAgg, TermAgg, RangeAgg } from '@/Aggs';
import { currentFieldValue, fieldInCurrentSQON, inCurrentSQON } from '@/SQONView/utils';

const composedTermAgg = ({ sqon, onValueChange, getTermAggProps = () => ({}), ...rest }) => (
  <TermAgg
    handleValueClick={({ generateNextSQON, value, field }) => {
      let nextSQON = generateNextSQON(sqon);
      const active = fieldInCurrentSQON({
        currentSQON: nextSQON?.content || [],
        field,
      });
      onValueChange({
        sqon: nextSQON,
        value: {
          field,
          value,
          active,
        },
      });
    }}
    isActive={(d) =>
      inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon,
      })
    }
    {...{ ...rest, ...getTermAggProps() }}
  />
);

const composedRangeAgg = ({
  sqon,
  onValueChange,
  field,
  stats,
  getRangeAggProps = () => ({}),
  ...rest
}) => (
  <RangeAgg
    sqonValues={
      !!sqon && {
        min: currentFieldValue({ sqon, dotField: field, op: '>=' }),
        max: currentFieldValue({ sqon, dotField: field, op: '<=' }),
      }
    }
    handleChange={({ generateNextSQON, field: { displayName, displayUnit, field }, value }) => {
      const nextSQON = generateNextSQON(sqon);

      onValueChange({
        sqon: nextSQON,
        value: {
          field: `${displayName} (${displayUnit})`,
          value,
          active: fieldInCurrentSQON({
            currentSQON: nextSQON?.content,
            field: field,
          }),
        },
      });
    }}
    {...{ ...rest, stats, field, ...getRangeAggProps() }}
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
        dotField: d.field,
        currentSQON: sqon,
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
            field: field,
          }),
        },
      });
    }}
    {...{ ...rest, ...getBooleanAggProps() }}
  />
);

const composedDatesAgg = ({ sqon, onValueChange, getDatesAggProps = () => ({}), ...rest }) => (
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
            field: field,
          }),
        },
      });
    }}
    getActiveValue={({ op, field }) =>
      currentFieldValue({
        op,
        dotField: field,
        sqon,
      })
    }
    {...{ ...rest, ...getDatesAggProps() }}
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
