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
  obj,
  { state, graphlField }: ISaveAggsStateMutationInput,
  context,
  info,
) => {
  return {
    state: { field: 'test', active: true, show: false },
    timestamp: 'sdfgdgfhs',
  };
};

export default {
  Query: {
    aggsState: async stuff => {
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
