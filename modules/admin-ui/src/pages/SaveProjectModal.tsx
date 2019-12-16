import * as React from 'react';
import { compose } from 'recompose';
import Component from 'react-component-component';
import withAddProjectMutation, {
  IPropsWithMutation as IPropsWithProjectAdd,
} from './VersionDashboard/AddProjectForm/graphqlService';
import Button from 'mineral-ui/Button';
import TextInput from 'mineral-ui/TextInput';
import Text from 'mineral-ui/Text';
import Card, { CardActions, CardBlock, CardDivider } from 'mineral-ui/Card';
import { FormField } from 'mineral-ui/Form';

import { IGlobalState } from 'src/store';
import { IGqlData } from 'src/gql/queries/allProjectData';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import { INewIndexArgs } from './VersionDashboard/AddProjectForm/types';
import Alert from 'src/components/Alert';

interface IReduxStateProps {
  projectData: IGqlData | null;
}
interface IReduxDispatchProps {}
interface IReduxProps extends IReduxStateProps, IReduxDispatchProps {}
const mapStateToProps = (state: IGlobalState): IReduxStateProps => ({
  projectData: state.configEditor.currentProjectData,
});
const mapDispatchToProps = (dispatch: Dispatch): IReduxDispatchProps => ({});

interface IProjectSaveModalExternalProps {
  onActionCanceled: () => any;
  onSaveComplete: () => any;
}
export default compose<
  IPropsWithProjectAdd & IReduxProps & IProjectSaveModalExternalProps,
  IProjectSaveModalExternalProps
>(
  connect(mapStateToProps, mapDispatchToProps),
  withAddProjectMutation,
)(({ addProject, projectData, onActionCanceled, onSaveComplete }) => {
  interface ILocalState {
    error: null | Error;
    projectId: string;
    loading: boolean;
  }
  interface IStateContainer {
    state: ILocalState;
    setState: (s: ILocalState) => void;
  }

  const initialState: ILocalState = {
    error: null,
    projectId: '',
    loading: false,
  };

  const onProjectIdInput = (s: IStateContainer) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    s.setState({
      ...s.state,
      projectId: e.currentTarget.value,
    });

  const showError = (s: IStateContainer) => (err: Error) => {
    const timeout = 5000;
    return new Promise(resolve => {
      s.setState({
        ...s.state,
        error: err,
      });
      setTimeout(
        () =>
          s.setState({
            ...s.state,
            error: null,
          }),
        timeout,
      );
    });
  };

  const onSaveConfirmed = (s: IStateContainer) => async e => {
    s.setState({ ...s.state, loading: true });
    if (projectData) {
      try {
        await addProject({
          projectId: s.state.projectId,
          indexConfigs: projectData.project.indices.map(
            (entry): INewIndexArgs => ({
              newIndexMutationInput: {
                esIndex: entry.esIndex,
                graphqlField: entry.graphqlField,
                projectId: s.state.projectId,
              },
              config: {
                aggsState: entry.aggsState.state,
                columnsState: entry.columnsState.state,
                extended: entry.extended,
                matchboxState: entry.matchBoxState.state,
              },
            }),
          ),
        });
        s.setState({
          ...s.state,
          loading: false,
        });
        onSaveComplete();
      } catch (err) {
        showError(s)(err);
      }
    }
  };

  return (
    <Component initialState={initialState}>
      {(s: IStateContainer) => (
        <Card>
          {s.state.error && (
            <CardBlock>
              <Alert variant="error">
                <Text element="h5">{s.state.error.message}</Text>
              </Alert>
            </CardBlock>
          )}
          <CardBlock>
            <Text>Enter the project ID to save this configuration as:</Text>
          </CardBlock>
          <CardBlock>
            <FormField
              label="Project ID"
              size="medium"
              disabled={s.state.loading}
              required={!s.state.projectId.length}
              input={TextInput}
              value={s.state.projectId}
              onChange={onProjectIdInput(s)}
            />
          </CardBlock>
          <CardDivider />
          <CardActions>
            <Button
              disabled={s.state.loading}
              primary={true}
              onClick={onSaveConfirmed(s)}
            >
              Save
            </Button>
            <Button disabled={s.state.loading} onClick={onActionCanceled}>
              Cancel
            </Button>
          </CardActions>
        </Card>
      )}
    </Component>
  );
});
