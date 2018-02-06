import React from 'react';

import SQONView, { Value, Bubble } from '../SQONView';

const CurrentSQON = ({ sqon, setSQON }) => {
  return (
    <SQONView
      sqon={sqon}
      ValueCrumb={({ value, nextSQON, ...props }) => (
        <Value onClick={() => setSQON(nextSQON)} {...props}>
          {value}
        </Value>
      )}
      Clear={({ nextSQON }) => (
        <Bubble className="sqon-clear" onClick={() => setSQON(nextSQON)}>
          Clear
        </Bubble>
      )}
    />
  );
};

export default CurrentSQON;
