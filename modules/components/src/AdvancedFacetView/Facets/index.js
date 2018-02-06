import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

export default ({ aggType, aggProps, title }) => (
  <div>
    {
      {
        Aggregations: <TermAggregation {...{ aggType, aggProps, title }} />,
        NumericAggregations: (
          <NumericAggregation {...{ aggType, aggProps, title }} />
        ),
      }[aggType]
    }
  </div>
);
