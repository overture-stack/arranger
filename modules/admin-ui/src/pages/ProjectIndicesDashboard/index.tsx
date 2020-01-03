import * as React from 'react';
import { connect } from 'react-redux';
import { compose } from 'recompose';
import { ApolloConsumer } from 'react-apollo';
import { THoc } from 'src/utils';
import Component from 'react-component-component';
import { QUERY, IGqlData } from 'src/gql/queries/allProjectData';
import { ApolloQueryResult } from 'apollo-boost';
import Table, { TableRow, TableCell } from 'mineral-ui/Table';
import { Link as RouterLink } from 'react-router-dom';

import { ActionType } from 'src/store/configEditorReducer';
import { IGlobalState } from 'src/store';
import Link from 'src/components/Link';
import ProjectActionButtons from '../ProjectActionButtons';
import Flex, { FlexItem } from 'mineral-ui/Flex';

/*****************
 * provides data fetcher
 *****************/
export interface IPropsWithProjectDataGetter {
  getProjectData: (projectId: string) => Promise<ApolloQueryResult<IGqlData>>;
}
export const withProjectDataGetter: THoc<
  {},
  IPropsWithProjectDataGetter
> = Wrapped => props => {
  return (
    <ApolloConsumer>
      {client => {
        const getProjectData = (
          projectId: string,
        ): Promise<ApolloQueryResult<IGqlData>> => {
          return client.query({
            query: QUERY,
            variables: {
              projectId,
            },
            fetchPolicy: 'no-cache',
          });
        };
        const mergedProps: IPropsWithProjectDataGetter = {
          getProjectData,
          ...props,
        };
        return <Wrapped {...mergedProps} />;
      }}
    </ApolloConsumer>
  );
};

/*********************
 * provides global state
 *********************/
interface IReduxStateProps {
  projectData: IGqlData | null;
}
interface IReduxDispatchProps {
  onDataLoaded: (data: IGqlData) => void;
}
export interface IPropsFromRedux
  extends IReduxStateProps,
    IReduxDispatchProps {}
const mapStateToProps = (state: IGlobalState): IReduxStateProps => ({
  projectData: state.configEditor.currentProjectData,
});
const mapDispatchToProps = (dispatch): IReduxDispatchProps => ({
  onDataLoaded: data => {
    const action = {
      type: ActionType.PROJECT_DATA_LOADED,
      payload: { data },
    };
    dispatch(action);
  },
});
export const reduxContainer = connect(mapStateToProps, mapDispatchToProps);

/*********************
 * local state container
 *********************/
interface IInjectedProps extends IPropsWithProjectDataGetter, IPropsFromRedux {}
interface IExternalProps {
  projectId: string;
}
const Dashboard: React.ComponentType<IInjectedProps & IExternalProps> = ({
  projectId,
  getProjectData,
  onDataLoaded,
  projectData,
}) => {
  React.useEffect(() => {
    if (!projectData) {
      getProjectData(projectId).then(({ data }) => {
        onDataLoaded(data);
      });
    }
  }, []);

  if (!projectData) {
    return <>...loading</>;
  } else {
    const {
      project: { indices },
    } = projectData;

    const rows = indices.map(index => ({
      row: () => {
        return (
          <TableRow>
            <TableCell>
              <RouterLink to={`/${projectId}/${index.graphqlField}`}>
                <Link>{index.graphqlField}</Link>
              </RouterLink>
            </TableCell>
            <TableCell>{index.esIndex}</TableCell>
            <TableCell>{index.esType}</TableCell>
            <TableCell>{index.hasMapping ? 'yes' : 'no'}</TableCell>
          </TableRow>
        );
      },
    }));

    return (
      <Flex direction="column">
        <Flex justifyContent="flex-end">
          <ProjectActionButtons />
        </Flex>
        <FlexItem>
          <Table
            title={`Arranger project: ${projectId}`}
            columns={[
              { content: 'Name (aka graphqlField)', key: 'graphqlField' },
              { content: 'ES index', key: 'esIndex' },
              { content: 'ES type', key: 'esType' },
              { content: 'has mapping', key: 'hasMapping' },
            ]}
            data={rows}
          />
        </FlexItem>
      </Flex>
    );
  }
};

export default compose<IInjectedProps, IExternalProps>(
  withProjectDataGetter,
  reduxContainer,
)(Dashboard);
