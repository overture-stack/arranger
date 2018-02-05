import React from 'react';
import TermAggregation from './TermAggregation';

export default ({ aggType, aggProps, title }) => (
  <div>
    {
      {
        Aggregations: <TermAggregation {...{ aggType, aggProps, title }} />,
        NumericAggregations: <div>PLACEHOLDER!!!</div>,
      }[aggType]
    }
  </div>
);
