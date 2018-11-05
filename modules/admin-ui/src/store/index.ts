import { createStore } from 'redux';

enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
}

export interface IReduxAction {
  type: ActionType;
  payload: any;
}

const initialState = {
  currentProject: '',
};

const reducers = (state = initialState, action: IReduxAction) => {
  switch (action.type) {
    default:
      return state;
  }
};

export default createStore(
  reducers,
  window['__REDUX_DEVTOOLS_EXTENSION__'] &&
    window['__REDUX_DEVTOOLS_EXTENSION__'](),
);
