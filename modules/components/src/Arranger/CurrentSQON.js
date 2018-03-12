import React from 'react';

import SQONView, { Value, Bubble, Field } from '../SQONView';

const CurrentSQON = ({ sqon, setSQON, extendedMapping }) => {
  return (
    <SQONView
      sqon={sqon}
      FieldCrumb={({ field, ...props }) => (
        <Field {...{ field, ...props }}>
          {extendedMapping?.find(e => e.field === field)?.displayName || field}
        </Field>
      )}
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
