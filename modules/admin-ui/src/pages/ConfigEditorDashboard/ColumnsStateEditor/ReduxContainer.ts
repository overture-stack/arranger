import { IGlobalState } from 'src/store';
import {
  viewProjectIndex,
  TReduxAction,
  ActionType,
} from 'src/store/configEditorReducer';
import { IColumnsState } from 'src/pages/VersionDashboard/AddProjectForm/types';
import { Dispatch } from 'redux';
import { ISortEventData } from '../AggsStateEditor/SortableAggsStateList';

export interface IReduxExternalProps {
  graphqlField: string;
}

export interface IReduxStateProps {
  columnsState: IColumnsState | null;
}

export interface IReduxDisplatProps {
  onFieldSortChange: (
    e: Pick<ISortEventData, Exclude<keyof ISortEventData, 'collection'>>,
  ) => void;
  onColumnPropertyChange: (newColumn: IColumnsState['columns'][0]) => void;
}

export const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IReduxExternalProps,
): IReduxStateProps => ({
  columnsState: !state.configEditor.currentProjectData
    ? null
    : viewProjectIndex(state.configEditor)(graphqlField).columnsState.state,
});

export const mapDispatchToProps = (
  dispatch: Dispatch<TReduxAction>,
  { graphqlField }: IReduxExternalProps,
): IReduxDisplatProps => ({
  onFieldSortChange: sortEvent => {
    dispatch({
      type: ActionType.COLUMNS_STATE_FIELD_ORDER_CHANGE,
      payload: {
        graphqlField: graphqlField,
        newIndex: sortEvent.newIndex,
        oldIndex: sortEvent.oldIndex,
      },
    });
  },
  onColumnPropertyChange: newColumn => {
    dispatch({
      type: ActionType.COLUMNS_STATE_COLUMN_PROPERTY_CHANGE,
      payload: {
        graphqlField: graphqlField,
        newField: newColumn,
      },
    });
  },
});
