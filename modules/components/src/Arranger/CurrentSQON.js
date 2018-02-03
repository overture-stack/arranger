import React from 'react';
import { compose } from 'recompose';
import { injectState } from 'freactal';

import SQONView, { Value, Bubble } from '../SQONView';

const enhance = compose(injectState);

let defaultSQON = {
  op: 'and',
  content: [],
};

const CurrentSQON = ({
  state: { arranger: { sqon } },
  effects: { setSQON },
}) => {
  return (
    <SQONView
      sqon={sqon || defaultSQON}
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

export default enhance(CurrentSQON);
