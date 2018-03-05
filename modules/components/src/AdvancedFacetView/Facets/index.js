import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

const aggregationTypeMap = {
  Aggregations: TermAggregation,
  NumericAggregations: NumericAggregation,
};

const AggregationComponent = ({ aggType, ...rest }) =>
  aggregationTypeMap[aggType]?.({ ...rest, aggType }) || null;

export default ({
  aggType,
  aggProps,
  title,
  path,
  sqon = {},
  constructEntryId = ({ value }) => console.log(value),
  onValueChange,
}) => (
  <AggregationComponent
    {...{ aggType, aggProps, title, sqon, path, constructEntryId }}
    onValueChange={({ value }) => {
      onValueChange({ value: value });
    }}
  />
);
