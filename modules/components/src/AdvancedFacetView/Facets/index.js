import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

export default ({
  aggType,
  aggProps,
  title,
  path,
  onValueChange = ({ value }) => console.log(value),
}) => (
  <div>
    {
      {
        Aggregations: (
          <TermAggregation
            {...{ aggType, aggProps, title }}
            onValueChange={({ value }) => {
              onValueChange({ value: value });
            }}
          />
        ),
        NumericAggregations: (
          <NumericAggregation
            {...{ aggType, aggProps, title }}
            onValueChange={({ value }) => {
              onValueChange({ value: value });
            }}
          />
        ),
      }[aggType]
    }
  </div>
);
