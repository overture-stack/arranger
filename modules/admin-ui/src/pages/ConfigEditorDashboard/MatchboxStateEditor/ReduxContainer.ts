import { IGlobalState } from 'src/store';
import { viewProjectIndex, TReduxAction } from 'src/store/configEditorReducer';
import { IGqlData } from 'src/gql/queries/allProjectData';
import { Dispatch } from 'redux';

export interface IReduxExternalProps {
  graphqlField: string;
}

export interface IReduxStateProps {
  quicksearchConfigs: IGqlData['project']['indices'][0]['matchBoxState']['state'];
}

export interface IReduxDispatchProps {}

export const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IReduxExternalProps,
): IReduxStateProps => ({
  quicksearchConfigs: viewProjectIndex(state.configEditor)(graphqlField)
    .matchBoxState.state,
});

export const mapDispatchToProps = (
  dispatch: Dispatch<TReduxAction>,
  { graphqlField }: IReduxExternalProps,
): IReduxDispatchProps => ({});
