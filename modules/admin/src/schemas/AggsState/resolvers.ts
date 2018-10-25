import { GraphQLResolveInfo } from 'graphql';
import { QueryContext } from '../../types';

interface AggStateInput {
  field: string;
  active: boolean;
  show: boolean;
}

interface ISaveAggsStateMutationInput {
  graphlField: string;
  state: AggStateInput;
}

const saveAggsState = (
  obj: {},
  { state, graphlField }: ISaveAggsStateMutationInput,
  context: QueryContext,
  info: GraphQLResolveInfo,
) => {
  return {
    state: { field: 'test', active: true, show: false },
    timestamp: 'sdfgdgfhs',
  };
};

export default {
  Query: {
    aggsState: async (stuff: {}) => {
      return {
        state: {
          field: 'test',
          active: true,
          show: false,
        },
        timestamp: 'sdfgdgfhs',
      };
    },
  },
  Mutation: {
    saveAggsState: saveAggsState,
  },
};
