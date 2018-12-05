import { IReduxAction } from '../index';
import { IGqlData } from 'src/gql/queries/allProjectData';
import { arrayMove } from 'react-sortable-hoc';
import { lensPath, view, set, Lens } from 'ramda';
import { IProjectConfigEditorState, ActionType, TReduxAction } from './types';

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
export const viewProjectIndex = (state: IProjectConfigEditorState) => (
  graphqlField: string,
): TProjectIndex => view(getIndexLens(state)(graphqlField), state);

const reducer = (
  state = initialState,
  action: TReduxAction,
): IProjectConfigEditorState => {
  const setProjectIndex = (state: IProjectConfigEditorState) => (
    graphqlField: string,
  ) => (data: TProjectIndex) =>
    set(getIndexLens(state)(graphqlField), data, state);

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
      const currentIndex = viewProjectIndex(state)(graphqlField);
      return setProjectIndex(state)(graphqlField)({
        ...currentIndex,
        extended: currentIndex.extended.map(f => ({
          ...(fieldConfig.field !== f.field ? f : fieldConfig),
        })),
      });
    }
    case ActionType.AGGS_STATE_FIELD_ORDER_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload: { graphqlField, newIndex, oldIndex } } = action;
      const currentIndex = viewProjectIndex(state)(graphqlField);
      return setProjectIndex(state)(graphqlField)({
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
      const currentIndex = viewProjectIndex(state)(graphqlField);
      return setProjectIndex(state)(graphqlField)({
        ...currentIndex,
        aggsState: {
          ...currentIndex.aggsState,
          state: currentIndex.aggsState.state.map(
            entry => (entry.field === newField.field ? newField : entry),
          ),
        },
      });
    }
    case ActionType.COLUMNS_STATE_FIELD_ORDER_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload: { graphqlField, newIndex, oldIndex } } = action;
      const currentIndex = viewProjectIndex(state)(graphqlField);
      return setProjectIndex(state)(graphqlField)({
        ...currentIndex,
        columnsState: {
          ...currentIndex.columnsState,
          state: {
            ...currentIndex.columnsState.state,
            columns: arrayMove(
              currentIndex.columnsState.state.columns,
              oldIndex,
              newIndex,
            ),
          },
        },
      });
    }
    case ActionType.COLUMNS_STATE_COLUMN_PROPERTY_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload: { graphqlField, newField } } = action;
      const currentIndex = viewProjectIndex(state)(graphqlField);
      return setProjectIndex(state)(graphqlField)({
        ...currentIndex,
        columnsState: {
          ...currentIndex.columnsState,
          state: {
            ...currentIndex.columnsState.state,
            columns: currentIndex.columnsState.state.columns.map(c => ({
              ...(c.field !== newField.field ? c : newField),
            })),
          },
        },
      });
    }
    case ActionType.QUICK_SEARCH_CONFIG_PROPERTY_CHANGE: {
      if (!state.currentProjectData) {
        return state;
      }
      const { payload: { graphqlField, newField } } = action;
      const currentIndex = viewProjectIndex(state)(graphqlField);
      return setProjectIndex(state)(graphqlField)({
        ...currentIndex,
        matchBoxState: {
          ...currentIndex.matchBoxState,
          state: currentIndex.matchBoxState.state.map(s => ({
            ...(s.field === newField.field ? newField : s),
          })),
        },
      });
    }
    default:
      return state;
  }
};

export default reducer;
export { IProjectConfigEditorState, ActionType, TReduxAction } from './types';
