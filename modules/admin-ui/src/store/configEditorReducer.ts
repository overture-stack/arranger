import { IReduxAction } from './index';
import { IGqlData } from 'src/gql/queries/allProjectData';

export enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
  PROJECT_DATA_LOADED = 'PROJECT_DATA_LOADED',
  'EXTENDED_MAPPING_FIELD_CHANGE' = 'EXTENDED_MAPPING_FIELD_CHANGE',
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
        ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
        {
          graphqlField: string;
          fieldConfig: {
            field: string;
            type: string;
            displayName: string;
            active: boolean;
            isArray: boolean;
            primaryKey: boolean;
            quickSearchEnabled: boolean;
            unit: string;
            displayValues: { [k: string]: string };
            rangeStep: number;
          };
        }
      >,
): IProjectConfigEditorState => {
  switch (action.type) {
    case ActionType.PROJECT_DATA_LOADED:
      return {
        ...state,
        currentProjectData: action.payload.data,
      };
    case ActionType.EXTENDED_MAPPING_FIELD_CHANGE:
      const { payload: { graphqlField, fieldConfig } } = action;
      if (!state.currentProjectData) {
        return state;
      }
      return {
        ...state,
        currentProjectData: {
          ...state.currentProjectData,
          project: {
            ...state.currentProjectData.project,
            indices: state.currentProjectData.project.indices.map(index => ({
              ...(index.graphqlField !== graphqlField
                ? index
                : {
                    ...index,
                    extended: index.extended.map(field => ({
                      ...field,
                      ...(fieldConfig.field !== field.field
                        ? {}
                        : {
                            ...fieldConfig,
                          }),
                    })),
                  }),
            })),
          },
        },
      };
    default:
      return state;
  }
};

export default reducer;
