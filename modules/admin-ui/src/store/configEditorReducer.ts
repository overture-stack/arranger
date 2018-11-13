import { IReduxAction } from './index';
import { IGqlData } from 'src/gql/queries/allProjectData';

export enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
  PROJECT_DATA_LOADED = 'PROJECT_DATA_LOADED',
}

export interface IProjectConfigEditorState {
  currentProjectData: IGqlData | null;
}
const initialState: IProjectConfigEditorState = {
  currentProjectData: null,
};

export interface IProjectDataLoadedAction
  extends IReduxAction<ActionType.PROJECT_DATA_LOADED, { data: IGqlData }> {}

const reducer = (
  state = initialState,
  action: IProjectDataLoadedAction,
): IProjectConfigEditorState => {
  switch (action.type) {
    case ActionType.PROJECT_DATA_LOADED:
      return {
        ...state,
        currentProjectData: action.payload.data,
      };
    default:
      return state;
  }
};

export default reducer;
