import React from 'react';
import Component from 'react-component-component';

import SQONView, { Value, Bubble, Field } from '../SQONView';
import api from '../utils/api';

const fetchExtendedMapping = ({ graphqlField, projectId }) =>
  api({
    endpoint: `/${projectId}/graphql`,
    body: {
      query: `
      {
        ${graphqlField}{
          extended
        }
      }
    `,
    },
  }).then(response => ({
    extendedMapping: response.data[graphqlField].extended,
  }));

const CurrentSQON = ({ sqon, setSQON, graphqlField, projectId }) => {
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
      {({ state: { extendedMapping } }) => {
        return (
          <SQONView
            sqon={sqon}
            FieldCrumb={({ field, ...props }) => (
              <Field {...{ field, ...props }}>
                {extendedMapping?.find(e => e.field === field)?.displayName ||
                  field}
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
      }}
    </Component>
  );
};

export default CurrentSQON;
