interface AggStateInput {
  field: string;
  active: boolean;
  show: boolean;
}

interface SaveAggsStateArgs {
  graphlField: string;
  state: AggStateInput;
}

const saveAggsState = (
  obj,
  { state, graphlField }: SaveAggsStateArgs,
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
