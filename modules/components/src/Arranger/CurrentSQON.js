import React from 'react';

import SQONView, { Value, Bubble, Field } from '../SQONView';
import State from '../State';
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
    <State
      initial={{ extendedMapping: null }}
      async={() => fetchExtendedMapping({ graphqlField, projectId })}
      render={({ extendedMapping }) => (
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
      )}
    />
  );
};

export default CurrentSQON;
