import { IGlobalState } from 'src/store';
import {
  viewProjectIndex,
  TReduxAction,
  ActionType,
} from 'src/store/configEditorReducer';
import { IGqlData } from 'src/gql/queries/allProjectData';
import { Dispatch } from 'redux';

export interface IReduxExternalProps {
  graphqlField: string;
}

export interface IReduxStateProps {
  quicksearchConfigs: IGqlData['project']['indices'][0]['matchBoxState']['state'];
  allFields: string[];
}

export interface IReduxDispatchProps {
  onFieldPropertyChange: (
    newFieldConfig: IGqlData['project']['indices'][0]['matchBoxState']['state'][0],
  ) => void;
}

export const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IReduxExternalProps,
): IReduxStateProps => ({
  quicksearchConfigs: viewProjectIndex(state.configEditor)(graphqlField)
    .matchBoxState.state,
  allFields: viewProjectIndex(state.configEditor)(graphqlField).extended.map(
    ({ field }) => field,
  ),
});

export const mapDispatchToProps = (
  dispatch: Dispatch<TReduxAction>,
  { graphqlField }: IReduxExternalProps,
): IReduxDispatchProps => ({
  onFieldPropertyChange: newFieldConfig => {
    dispatch({
      type: ActionType.QUICK_SEARCH_CONFIG_PROPERTY_CHANGE,
      payload: {
        graphqlField,
        newField: newFieldConfig,
      },
    });
  },
});
