import * as React from 'react';
import Component from 'react-component-component';
import { Query, QueryResult } from 'react-apollo';
import gql from 'graphql-tag';
import 'react-table/react-table.css';
import { compose } from 'recompose';
import { THoc } from 'src/utils';
import { connect } from 'react-redux';
import styled from 'react-emotion';
import { sortBy } from 'lodash';
import Link from 'mineral-ui/Link';
import Button from 'mineral-ui/Button';
import Table, { TableRow, TableCell } from 'mineral-ui/Table';
import { ApolloError } from 'apollo-boost';

import ProjectDeleteButton from './DeleteButton';
import AddProjectForm from './AddProjectForm/index';
import { ModalOverlay } from 'src/components/Modal';

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
      {({ data, loading, error }: QueryResult<IGqlQueryData>) => {
        if (loading) {
          return 'loading...';
        }
        return (
          <Component {...props} data={data as IGqlQueryData} error={error} />
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
}
interface IPropsFromRedux extends IReduxDispatchProps, IReduxStateProps {}
const withGlobalState: THoc<{}, IPropsFromRedux> = connect(
  (): IReduxStateProps => ({}),
  (dispatch): IReduxDispatchProps => ({
    onVersionSelect: (projectId: string) => {
      dispatch({ type: 'PROJECT_SELECT', payload: { projectId } });
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
    data,
    onVersionSelect,
    localState: { state: { isAddingProject }, mutations: { setAddingProject } },
    // error,
  } = props;

  const { projects = [] } = data;

  const columnsData = sortBy(
    projects.map(project => ({
      id: project.id,
      timestamp: project.timestamp,
      indexCount: (project.indices || []).length,
    })),
    'timestamp',
  );

  const rows = columnsData.map(entry => ({
    row: ({ onIdClick = () => onVersionSelect(entry.id), data = entry }) => {
      const StyledLink = styled(Link)`
        cursor: pointer;
      `;
      return (
        <TableRow>
          <TableCell onClick={onIdClick}>
            <StyledLink>{data.id}</StyledLink>
          </TableCell>
          <TableCell>{data.indexCount}</TableCell>
          <TableCell>{entry.timestamp}</TableCell>
          <TableCell>
            <ProjectDeleteButton projectId={data.id} />
          </TableCell>
        </TableRow>
      );
    },
  }));

  const onAddButtonClick = () => setAddingProject(!isAddingProject);
  const onCancelAddProject = () => setAddingProject(false);

  return (
    <div>
      <Table
        title="Project versions"
        rowKey="id"
        columns={[
          { content: 'Project Id', key: 'id' },
          { content: 'Index Counts', key: 'indexCount' },
          { content: 'Created', key: 'timestamp' },
          { content: 'Delete', key: 'delete' },
        ]}
        data={rows}
      />
      <div>
        {isAddingProject && (
          <ModalOverlay>
            <AddProjectForm onCancel={onCancelAddProject} />
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
