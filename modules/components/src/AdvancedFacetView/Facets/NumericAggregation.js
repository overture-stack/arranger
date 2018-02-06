import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';

export default ({ aggType, aggProps, title }) => (
  <RangeAgg stats={aggProps ? aggProps.stats : null} displayName={title} />
);
