import { createStore, combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import { History } from 'history';

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

const mainReducers = (state = initialState, action: IReduxAction): State => {
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

export const createLocalStore = ({ history }: { history: History }) =>
  createStore(
    combineReducers({ mainReducers, router: connectRouter(history) }),
    window['__REDUX_DEVTOOLS_EXTENSION__'] &&
      window['__REDUX_DEVTOOLS_EXTENSION__'](),
  );
