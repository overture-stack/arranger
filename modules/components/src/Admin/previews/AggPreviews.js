import React from 'react';

import Aggregations from '../../Arranger/Aggregations';

export default props => (
  <Aggregations
    {...{
      ...props,
      onLayoutChange: layout => console.log(layout),
      isArrangable: true,
    }}
  />
);
