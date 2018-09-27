interface IColumnStateInput {
  field: string;
  active: boolean;
  show: boolean;
}

interface IColumnsStateMutationInput {
  graphlField: string;
  state: IColumnStateInput;
}

const saveColumnsState = (
  obj,
  { state, graphlField }: IColumnsStateMutationInput,
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
    columnsState: async stuff => {
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
    saveColumnsState: saveColumnsState,
  },
};
