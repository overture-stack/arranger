import * as React from 'react';
import Component from 'react-component-component';
import { Query, QueryResult, OperationVariables } from 'react-apollo';
import gql from 'graphql-tag';
import 'react-table/react-table.css';
import { compose } from 'recompose';
import { THoc } from 'src/utils';
import { connect } from 'react-redux';
import { sortBy } from 'lodash';
import Button from 'mineral-ui/Button';
import Table, { TableRow, TableCell } from 'mineral-ui/Table';
import { ApolloError, ApolloQueryResult } from 'apollo-boost';
import { Link as RouterLink } from 'react-router-dom';
import Text from 'mineral-ui/Text';

import ProjectDeleteButton from './DeleteButton';
import AddProjectForm from './AddProjectForm/index';
import { ModalOverlay } from 'src/components/Modal';
import ExportButton from './ExportButton';
import Link from 'src/components/Link';
import { ActionType } from 'src/store/configEditorReducer';
import Alert from 'src/components/Alert';

/************************
 * provides graphql query
 *************************/
interface IGqlQueryData {
  projects: {
    id: string;
    timestamp: string;
    indices: { id: string }[] | null;
  }[];
}
interface IPropsFromGql {
  data: IGqlQueryData;
  error: ApolloError | undefined;
  refetch: (
    variables?: OperationVariables | undefined,
  ) => Promise<ApolloQueryResult<IGqlQueryData>>;
}
const withQuery: THoc<{}, IPropsFromGql> = Component => {
  const query = gql`
    {
      projects {
        id
        timestamp
        indices {
          id
        }
      }
    }
  `;

  return props => (
    <Query query={query} partialRefetch={true} displayName="ProjectsQuery">
      {({ data, loading, error, refetch }: QueryResult<IGqlQueryData>) => {
        if (loading) {
          return 'loading...';
        }
        return (
          <Component
            {...props}
            data={data as IGqlQueryData}
            error={error}
            refetch={refetch}
          />
        );
      }}
    </Query>
  );
};

/************************
 * provides redux global state
 *************************/
interface IReduxStateProps {}
interface IReduxDispatchProps {
  onVersionSelect: (version: String) => void;
  clearEditingProject: () => void;
}
interface IPropsFromRedux extends IReduxDispatchProps, IReduxStateProps {}
const withGlobalState: THoc<{}, IPropsFromRedux> = connect(
  (): IReduxStateProps => ({}),
  (dispatch): IReduxDispatchProps => ({
    onVersionSelect: (projectId: string) => {
      dispatch({
        type: ActionType.PROJECT_SELECT,
        payload: { projectId },
      });
    },
    clearEditingProject: () => {
      dispatch({ type: ActionType.PROJECT_EDIT_CLEAR, payload: {} });
    },
  }),
);

/*************************
 * Provides local state
 *************************/
interface ILocalStateProps {
  isAddingProject: boolean;
}
interface ILocalDispatchProps {
  setAddingProject: (state: boolean) => void;
}
interface IPropsFromLocalState {
  localState: {
    state: ILocalStateProps;
    mutations: ILocalDispatchProps;
  };
}
const withLocalState: THoc<{}, IPropsFromLocalState> = Wrapped => props => {
  const initialState: ILocalStateProps = { isAddingProject: false };
  return (
    <Component initialState={initialState}>
      {({ state, setState }: { state: ILocalStateProps; setState: any }) => {
        const mutations: ILocalDispatchProps = {
          setAddingProject: (s: boolean) => setState({ isAddingProject: s }),
        };
        return (
          <Wrapped
            {...props}
            localState={{
              state,
              mutations,
            }}
          />
        );
      }}
    </Component>
  );
};

/*************************
 * Layout component
 *************************/
interface IInjectedProps
  extends IPropsFromGql,
    IPropsFromRedux,
    IPropsFromLocalState {}
interface IExternalProps {}
const Layout: React.ComponentType<IInjectedProps & IExternalProps> = props => {
  const {
    data = { projects: [] },
    onVersionSelect,
    localState: {
      state: { isAddingProject },
      mutations: { setAddingProject },
    },
    refetch,
    clearEditingProject,
    error,
  } = props;

  const { projects = [] } = data;

  const columnsData = projects.map(project => ({
    id: project.id,
    timestamp: project.timestamp,
    indexCount: (project.indices || []).length,
  }));

  const sorted: typeof columnsData = sortBy(columnsData, 'timestamp');

  const onAddButtonClick = () => setAddingProject(!isAddingProject);
  const onCancelAddProject = () => setAddingProject(false);
  const onProjectAdded = () => refetch().then(() => setAddingProject(false));

  React.useEffect(() => {
    clearEditingProject();
    refetch();
  }, []);

  const rows = sorted.map(entry => ({
    row: ({ onIdClick = () => onVersionSelect(entry.id), data = entry }) => {
      const onProjectRemoved = () => refetch();
      return (
        <TableRow>
          <TableCell>
            <RouterLink to={`/${data.id}`}>
              <Link>{data.id}</Link>
            </RouterLink>
          </TableCell>
          <TableCell>{data.indexCount}</TableCell>
          <TableCell>{entry.timestamp}</TableCell>
          <TableCell>
            <ExportButton projectId={entry.id} />
          </TableCell>
          <TableCell>
            <ProjectDeleteButton
              projectId={data.id}
              onProjectRemoved={onProjectRemoved}
            />
          </TableCell>
        </TableRow>
      );
    },
  }));

  return (
    <div>
      {error && (
        <Alert variant="error">
          <Text>{error.message}</Text>
        </Alert>
      )}
      <Table
        title="Project versions"
        rowKey="id"
        columns={[
          { content: 'Project ID', key: 'id' },
          { content: 'Index Counts', key: 'indexCount' },
          { content: 'Created', key: 'timestamp' },
          { content: 'Export configurations', key: 'export' },
          { content: 'Delete', key: 'delete' },
        ]}
        data={rows}
      />
      <div>
        {isAddingProject && (
          <ModalOverlay>
            <AddProjectForm
              onCancel={onCancelAddProject}
              onProjectAdded={onProjectAdded}
            />
          </ModalOverlay>
        )}
        <Button onClick={onAddButtonClick} size="medium" primary={true}>
          Add Project
        </Button>
      </div>
    </div>
  );
};

export default compose<{}, IExternalProps>(
  withQuery,
  withGlobalState,
  withLocalState,
)(Layout);
