import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';

export default ({ aggType, aggProps, title, onValueChange }) => (
  <RangeAgg
    stats={aggProps ? aggProps.stats : null}
    displayName={title}
    handleChange={onValueChange}
  />
);
