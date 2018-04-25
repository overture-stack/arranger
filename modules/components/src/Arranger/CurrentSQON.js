import React from 'react';
import Component from 'react-component-component';

import SQONView, { Value, Bubble, Field } from '../SQONView';
import { fetchExtendedMapping } from '../utils/api';

export const CurrentSQON = ({
  sqon,
  setSQON,
  extendedMapping,
  translateSQONValue = x => x,
  findExtendedMappingField = field =>
    extendedMapping?.find(e => e.field === field),
  ...props
}) => (
  <SQONView
    sqon={sqon}
    FieldCrumb={({ field, nextSQON, ...props }) => (
      <Field {...{ field, ...props }}>
        {findExtendedMappingField(field)?.displayName || field}
      </Field>
    )}
    ValueCrumb={({ field, value, nextSQON, ...props }) => (
      <Value onClick={() => setSQON(nextSQON)} {...props}>
        {translateSQONValue(
          (findExtendedMappingField(field)?.displayValues || {})[value] ||
            value,
        )}
      </Value>
    )}
    Clear={({ nextSQON }) => (
      <Bubble className="sqon-clear" onClick={() => setSQON(nextSQON)}>
        Clear
      </Bubble>
    )}
  />
);

const CurrentSQONState = ({
  sqon,
  setSQON,
  graphqlField,
  projectId,
  ...props
}) => {
  return (
    <Component
      initialState={{ extendedMapping: null }}
      didMount={({ state: { extendedMapping }, setState }) =>
        fetchExtendedMapping({ graphqlField, projectId }).then(
          ({ extendedMapping }) => {
            return setState({ extendedMapping });
          },
        )
      }
    >
      {({ state: { extendedMapping } }) => (
        <CurrentSQON {...{ sqon, setSQON, extendedMapping, ...props }} />
      )}
    </Component>
  );
};

export default CurrentSQONState;
