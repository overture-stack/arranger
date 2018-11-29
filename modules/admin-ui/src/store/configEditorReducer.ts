import { IReduxAction } from './index';
import { IGqlData } from 'src/gql/queries/allProjectData';
import { arrayMove } from 'react-sortable-hoc';
import { lensPath, view, set, Lens } from 'ramda';

export enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
  PROJECT_DATA_LOADED = 'PROJECT_DATA_LOADED',
  EXTENDED_MAPPING_FIELD_CHANGE = 'EXTENDED_MAPPING_FIELD_CHANGE',
  AGGS_STATE_FIELD_ORDER_CHANGE = 'AGGS_STATE_FIELD_ORDER_CHANGE',
  AGGS_STATE_FIELD_PROPERTY_CHANGE = 'AGGS_STATE_FIELD_PROPERTY_CHANGE',
  PROJECT_EDIT_CLEAR = 'PROJECT_EDIT_CLEAR',
}

export interface IProjectConfigEditorState {
  currentProjectData: IGqlData | null;
}
const initialState: IProjectConfigEditorState = {
  currentProjectData: null,
};

type TProjectIndex = IGqlData['project']['indices'][0];
const getIndexLens = (state: IProjectConfigEditorState) => (
  graphqlField: string,
): Lens =>
  lensPath([
    'currentProjectData',
    'project',
    'indices',
    !state.currentProjectData
      ? 0
      : state.currentProjectData.project.indices.findIndex(
          entry => entry.graphqlField === graphqlField,
        ),
  ]);

export interface IProjectDataLoadedAction
  extends IReduxAction<ActionType.PROJECT_DATA_LOADED, { data: IGqlData }> {}

export type TReduxAction =
  | IReduxAction<ActionType.PROJECT_DATA_LOADED, { data: IGqlData }>
  | IReduxAction<
      ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      {
        graphqlField: string;
        fieldConfig: IGqlData['project']['indices'][0]['extended'][0];
      }
    >
  | IReduxAction<
      ActionType.AGGS_STATE_FIELD_ORDER_CHANGE,
      { graphqlField: string; newIndex: number; oldIndex: number }
    >
  | IReduxAction<
      ActionType.AGGS_STATE_FIELD_PROPERTY_CHANGE,
      {
        graphqlField: string;
        newField: IGqlData['project']['indices'][0]['aggsState']['state'][0];
      }
    >
  | IReduxAction<ActionType.PROJECT_EDIT_CLEAR, {}>;

const reducer = (
  state = initialState,
  action: TReduxAction,
): IProjectConfigEditorState => {
  const getIndexLensWithState = getIndexLens(state);
  const viewProjectIndex = (graphqlField: string): TProjectIndex =>
    view(getIndexLensWithState(graphqlField), state);
  const setProjectIndex = (graphqlField: string) => (data: TProjectIndex) =>
    set(getIndexLensWithState(graphqlField), data, state);

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
      const currentIndex = viewProjectIndex(graphqlField);
      return setProjectIndex(graphqlField)({
        ...currentIndex,
        extended: currentIndex.extended.map(field => ({
          ...field,
          ...(fieldConfig.field !== field.field
            ? {}
            : {
                ...fieldConfig,
              }),
        })),
      });
    }
    case ActionType.AGGS_STATE_FIELD_ORDER_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload: { graphqlField, newIndex, oldIndex } } = action;
      const currentIndex = viewProjectIndex(graphqlField);
      return setProjectIndex(graphqlField)({
        ...currentIndex,
        aggsState: {
          ...currentIndex.aggsState,
          state: arrayMove(currentIndex.aggsState.state, oldIndex, newIndex),
        },
      });
    }
    case ActionType.AGGS_STATE_FIELD_PROPERTY_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload: { graphqlField, newField } } = action;
      const currentIndex = viewProjectIndex(graphqlField);
      return setProjectIndex(graphqlField)({
        ...currentIndex,
        aggsState: {
          ...currentIndex.aggsState,
          state: currentIndex.aggsState.state.map(
            entry => (entry.field === newField.field ? newField : entry),
          ),
        },
      });
    }
    default:
      return state;
  }
};

export default reducer;
