import React from 'react';
import TermAggs from '../../Aggs/TermAgg';

export default ({ aggType, aggProps, title }) => (
  <TermAggs buckets={aggProps ? aggProps.buckets : null} displayName={title} />
);
