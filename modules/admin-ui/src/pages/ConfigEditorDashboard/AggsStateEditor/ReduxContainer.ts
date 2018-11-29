import { IGlobalState } from 'src/store';
import {
  IAggsStateEntry,
  IAggsState,
} from 'src/pages/VersionDashboard/AddProjectForm/types';
import { Dispatch } from 'redux';
import { TReduxAction, ActionType } from 'src/store/configEditorReducer';

interface IExternalProps {
  graphqlField: string;
}

export interface IAggsStateEntryWithIndex extends IAggsStateEntry {
  index: number;
}

export interface IReduxStateProps {
  aggsState: IAggsState;
}

export interface IReduxDispatchProps {
  onFieldSortChange: (
    field: IAggsStateEntryWithIndex,
    newIndex: number,
  ) => void;
  onFieldPropertyChange: ({ newField: IAggsStateEntryWithIndex }) => void;
}

export const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IExternalProps,
): IReduxStateProps => {
  if (!state.configEditor.currentProjectData) {
    return { aggsState: [] };
  } else {
    const currentProjectIndexData = state.configEditor.currentProjectData.project.indices.find(
      index => index.graphqlField === graphqlField,
    );
    if (currentProjectIndexData) {
      return {
        aggsState: currentProjectIndexData.aggsState.state,
      };
    } else {
      return { aggsState: [] };
    }
  }
};

export const mapDispatchToProps = (
  dispatch: Dispatch<TReduxAction>,
  state: IExternalProps,
): IReduxDispatchProps => ({
  onFieldSortChange: (field, newIndex) => {
    dispatch({
      type: ActionType.AGGS_STATE_FIELD_ORDER_CHANGE,
      payload: {
        graphqlField: state.graphqlField,
        oldIndex: field.index,
        newIndex,
      },
    });
  },
  onFieldPropertyChange: ({ newField }) => {
    const { active, field, show } = newField;
    dispatch({
      type: ActionType.AGGS_STATE_FIELD_PROPERTY_CHANGE,
      payload: {
        graphqlField: state.graphqlField,
        newField: {
          active,
          field,
          show,
        },
      },
    });
  },
});
