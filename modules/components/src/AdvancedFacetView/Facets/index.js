import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

const aggregationTypeMap = {
  Aggregations: TermAggregation,
  NumericAggregations: NumericAggregation,
};

const AggregationComponent = ({ aggType, ...rest }) =>
  aggregationTypeMap[aggType]({ ...rest, aggType });

export default ({
  aggType,
  aggProps,
  title,
  path,
  sqon = {},
  onValueChange = ({ value }) => console.log(value),
}) => (
  <div>
    {
      <AggregationComponent
        {...{ aggType, aggProps, title, sqon, path }}
        onValueChange={({ value }) => {
          onValueChange({ value: value });
        }}
      />
    }
  </div>
);
