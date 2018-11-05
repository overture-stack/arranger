import { createStore } from 'redux';

enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
}

export interface IReduxAction {
  type: ActionType;
  payload: any;
}

export interface State {
  currentProject: string;
}

const initialState: State = {
  currentProject: '',
};

const reducers = (state = initialState, action: IReduxAction): State => {
  switch (action.type) {
    case ActionType.PROJECT_SELECT:
      return {
        ...state,
        currentProject: action.payload.projectId,
      };
    default:
      return state;
  }
};

export default createStore(
  reducers,
  window['__REDUX_DEVTOOLS_EXTENSION__'] &&
    window['__REDUX_DEVTOOLS_EXTENSION__'](),
);
