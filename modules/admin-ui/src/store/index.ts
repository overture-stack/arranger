import { createStore, combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import { History } from 'history';
import configEditor, { IProjectConfigEditorState } from './configEditorReducer';

export interface IReduxAction<ActionType, P = any> {
  type: ActionType;
  payload: P;
}

export interface IGlobalState {
  configEditor: IProjectConfigEditorState;
}

export const createLocalStore = ({ history }: { history: History }) =>
  createStore(
    combineReducers({
      configEditor,
      router: connectRouter(history),
    }),
    window['__REDUX_DEVTOOLS_EXTENSION__'] &&
      window['__REDUX_DEVTOOLS_EXTENSION__'](),
  );
