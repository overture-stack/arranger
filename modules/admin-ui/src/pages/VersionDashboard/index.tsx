import * as React from 'react';
import { Query, QueryResult } from 'react-apollo';
import gql from 'graphql-tag';
import 'react-table/react-table.css';
import { compose } from 'recompose';
import { THoc } from 'src/utils';
import { connect } from 'react-redux';
import Table from 'mineral-ui/Table';
import {
  default as ClickableCell,
  TableCellRenderProp,
} from '../../components/ClickableTableCell';

/************************
 * provides graphql query
 *************************/
interface IGqlQueryData {
  projects: { id: string; indices: { id: string }[] }[];
}
interface IPropsFromGql {
  data: IGqlQueryData;
}
const withQuery: THoc<{}, IPropsFromGql> = Component => {
  const query = gql`
    {
      projects {
        id
        indices {
          id
        }
      }
    }
  `;
  return props => (
    <Query query={query}>
      {({ data, loading, error }: QueryResult<IGqlQueryData>) => {
        if (loading) {
          return 'loading...';
        } else if (error) {
          return error.message;
        }
        return <Component {...props} data={data as IGqlQueryData} />;
      }}
    </Query>
  );
};

/************************
 * provides redux local state
 *************************/
interface IPropsFromState {}
interface IPropsFromDispatch {
  onVersionSelect: (version: String) => void;
}
type TPropsFromRedux = IPropsFromDispatch & IPropsFromState;
const withClientState: THoc<{}, TPropsFromRedux> = connect(
  () => ({}),
  (dispatch): IPropsFromDispatch => ({
    onVersionSelect: (projectId: string) => {
      dispatch({ type: 'PROJECT_SELECT', payload: { projectId } });
    },
  }),
);

/************************
 * Visual Component
 *************************/
type TVersionDashboardDisplayInjectedProps = IPropsFromGql & TPropsFromRedux;
type TVersionDashboardExternalProps = {};
const Renderable: React.ComponentType<
  TVersionDashboardDisplayInjectedProps & TVersionDashboardExternalProps
> = props => {
  const { data: { projects }, onVersionSelect } = props;
  const columnsData = projects.map(project => ({
    id: project.id,
    indexCount: project.indices.length,
  }));
  const onCellClick = (props: TableCellRenderProp) =>
    onVersionSelect(props.props.children as string);
  const CustomCell = (props: TableCellRenderProp) => (
    <ClickableCell props={props} onClick={onCellClick} />
  );
  return (
    <Table
      title="Project versions"
      sortable={true}
      columns={[
        { content: 'Project Id', key: 'id', cell: CustomCell },
        { content: 'Index Counts', key: 'indexCount' },
      ]}
      data={columnsData}
    />
  );
};

export default compose<{}, TVersionDashboardExternalProps>(
  withQuery,
  withClientState,
)(Renderable);
