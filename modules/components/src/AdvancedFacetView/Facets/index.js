import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

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
      {
        Aggregations: (
          <TermAggregation
            {...{ aggType, aggProps, title, sqon, path }}
            onValueChange={({ value }) => {
              onValueChange({ value: value });
            }}
          />
        ),
        NumericAggregations: (
          <NumericAggregation
            {...{ aggType, aggProps, title, sqon, path }}
            onValueChange={({ value }) => {
              onValueChange({ value: value });
            }}
          />
        ),
      }[aggType]
    }
  </div>
);
