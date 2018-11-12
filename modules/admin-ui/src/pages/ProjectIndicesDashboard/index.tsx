import * as React from 'react';
import { connect } from 'react-redux';
import { compose } from 'recompose';
import { ApolloConsumer } from 'react-apollo';
import gql from 'graphql-tag';
import { THoc } from 'src/utils';
import Component from 'react-component-component';

interface IPropsWithProjectDataGetter {
  getProjectData: (projectId: string) => Promise<{ data: any }>;
}
const withProjectDataGetter: THoc<
  {},
  IPropsWithProjectDataGetter
> = Wrapped => props => {
  const QUERY = gql`
    {
      projects {
        id
      }
    }
  `;
  QUERY;
  return (
    <ApolloConsumer>
      {client => {
        const getProjectData = (projectId: string) => {
          // return client.query({
          //   query: QUERY,
          // });
          return new Promise<{ data: any }>(resolve => {
            setTimeout(() => {
              resolve({ data: 'sdfgsdfg' });
            }, 1000);
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

interface IInjectedProps extends IPropsWithProjectDataGetter {}
interface IExternalProps {
  projectId: string;
}

const Component: React.ComponentType<
  IInjectedProps & IExternalProps
> = props => {
  const { projectId } = props;
  return <div>{projectId}</div>;
};

const mapStateToProps = state => ({});
const mapDispatchToProps = dispatch => ({});

export default compose<{}, IExternalProps>(
  connect(mapStateToProps, mapDispatchToProps),
  withProjectDataGetter,
)(Component);
