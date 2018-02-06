import React from 'react';
import TermAggs from '../../Aggs/TermAgg';

export default ({ aggType, aggProps, title, onValueChange }) => (
  <TermAggs
    key={title}
    handleValueClick={bucket => {
      onValueChange({
        value: bucket.key,
      });
    }}
    buckets={aggProps ? aggProps.buckets : null}
    displayName={title}
  />
);
