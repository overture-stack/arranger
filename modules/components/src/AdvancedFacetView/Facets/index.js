import React from 'react';
import TermAggs from '../../Aggs/TermAgg';

export default ({ aggType, aggProps, title }) => (
  <div>
    {
      {
        Aggregations: <TermAggs buckets={aggProps ? aggProps.buckets : null} />,
        NumericAggregations: <div>PLACEHOLDER!!!</div>,
      }[aggType]
    }
  </div>
);
