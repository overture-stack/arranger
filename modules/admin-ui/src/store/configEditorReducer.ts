import { IReduxAction } from './index';
import { IGqlData } from 'src/gql/queries/allProjectData';
import { arrayMove } from 'react-sortable-hoc';

export enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
  PROJECT_DATA_LOADED = 'PROJECT_DATA_LOADED',
  EXTENDED_MAPPING_FIELD_CHANGE = 'EXTENDED_MAPPING_FIELD_CHANGE',
  AGGS_STATE_FIELD_ORDER_CHANGE = 'AGGS_STATE_FIELD_ORDER_CHANGE',
  PROJECT_EDIT_CLEAR = 'PROJECT_EDIT_CLEAR',
}

export interface IProjectConfigEditorState {
  currentProjectData: IGqlData | null;
}
const initialState: IProjectConfigEditorState = {
  currentProjectData: null,
};

export interface IProjectDataLoadedAction
  extends IReduxAction<ActionType.PROJECT_DATA_LOADED, { data: IGqlData }> {}

export type TReduxAction =
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
    >
  | IReduxAction<
      ActionType.AGGS_STATE_FIELD_ORDER_CHANGE,
      {
        graphqlField: string;
        newIndex: number;
        oldIndex: number;
      }
    >
  | IReduxAction<ActionType.PROJECT_EDIT_CLEAR, {}>;

const reducer = (
  state = initialState,
  action: TReduxAction,
): IProjectConfigEditorState => {
  switch (action.type) {
    case ActionType.PROJECT_EDIT_CLEAR: {
      return {
        ...state,
        currentProjectData: null,
      };
    }
    case ActionType.PROJECT_DATA_LOADED: {
      return {
        ...state,
        currentProjectData: action.payload.data,
      };
    }
    case ActionType.EXTENDED_MAPPING_FIELD_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload: { graphqlField, fieldConfig } } = action;
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
    }
    case ActionType.AGGS_STATE_FIELD_ORDER_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload } = action;
      return {
        ...state,
        currentProjectData: {
          ...state.currentProjectData,
          project: {
            ...state.currentProjectData.project,
            indices: state.currentProjectData.project.indices.map(
              projectIndex => ({
                ...(projectIndex.graphqlField !== payload.graphqlField
                  ? projectIndex
                  : {
                      ...projectIndex,
                      aggsState: {
                        ...projectIndex.aggsState,
                        state: arrayMove(
                          projectIndex.aggsState.state,
                          payload.oldIndex,
                          payload.newIndex,
                        ),
                      },
                    }),
              }),
            ),
          },
        },
      };
    }
    default:
      return state;
  }
};

export default reducer;
