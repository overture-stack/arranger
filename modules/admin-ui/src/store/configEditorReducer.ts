import { IReduxAction } from './index';
import { IGqlData } from 'src/gql/queries/allProjectData';

export enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
  PROJECT_DATA_LOADED = 'PROJECT_DATA_LOADED',
  'EXTENDED_MAPPING_DISPLAY_NAME_CHANGE' = 'EXTENDED_MAPPING_DISPLAY_NAME_CHANGE',
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
  action:
    | IReduxAction<ActionType.PROJECT_DATA_LOADED, { data: IGqlData }>
    | IReduxAction<
        ActionType.EXTENDED_MAPPING_DISPLAY_NAME_CHANGE,
        {
          graphqlField: string;
          field: string;
          value: string;
        }
      >,
): IProjectConfigEditorState => {
  switch (action.type) {
    case ActionType.PROJECT_DATA_LOADED:
      return {
        ...state,
        currentProjectData: action.payload.data,
      };
    case ActionType.EXTENDED_MAPPING_DISPLAY_NAME_CHANGE:
      const { payload: { field, graphqlField, value } } = action;
      return {
        ...state,
      };
    default:
      return state;
  }
};

export default reducer;
