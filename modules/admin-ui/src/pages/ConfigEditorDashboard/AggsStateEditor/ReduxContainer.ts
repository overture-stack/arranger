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
  aggsState?: IAggsState;
}

export interface IReduxDispatchProps {
  onFieldSortChange: (
    field: IAggsStateEntryWithIndex,
    newIndex: number,
  ) => void;
}

export const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IExternalProps,
): IReduxStateProps => {
  if (!state.configEditor.currentProjectData) {
    return {};
  } else {
    const currentProjectIndexData = state.configEditor.currentProjectData.project.indices.find(
      index => index.graphqlField === graphqlField,
    );
    if (currentProjectIndexData) {
      return {
        aggsState: currentProjectIndexData.aggsState.state,
      };
    } else {
      return {};
    }
  }
};

export const mapDispatchToProps = (
  dispatch: Dispatch<TReduxAction>,
  state: IExternalProps,
): IReduxDispatchProps => ({
  onFieldSortChange: (field: IAggsStateEntryWithIndex, newIndex: number) => {
    dispatch({
      type: ActionType.AGGS_STATE_FIELD_ORDER_CHANGE,
      payload: {
        graphqlField: state.graphqlField,
        oldIndex: field.index,
        newIndex,
      },
    });
  },
});
