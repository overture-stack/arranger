import * as React from 'react';
import Component from 'react-component-component';
import {
  reduxContainer,
  withProjectDataGetter,
  IPropsWithProjectDataGetter,
  IPropsFromRedux,
} from 'src/pages/ProjectIndicesDashboard';
import { compose } from 'recompose';
import Tabs, { Tab } from 'mineral-ui/Tabs';
// import Link from 'src/components/Link';

import ExtendedMappingEditor from './ExtendedMappingEditor';
import AggsStateEditor from './AggsStateEditor';
import ColumnsStateEditor from './ColumnsStateEditor';
import MatchboxStateEditor from './MatchboxStateEditor';

interface IInjectedProps extends IPropsFromRedux, IPropsWithProjectDataGetter {}
interface IExternalProps {
  projectId: string;
  graphqlField: string;
}
const Dashboard: React.ComponentType<IInjectedProps & IExternalProps> = ({
  getProjectData,
  onDataLoaded,
  projectData,
  projectId,
  graphqlField,
}) => {
  const didMount = () => {
    if (!projectData) {
      getProjectData(projectId).then(({ data }) => {
        onDataLoaded(data);
      });
    }
  };
  return (
    <Component didMount={didMount}>
      {() => (
        <div>
          {/* {[projectId, graphqlField].map(path => (
              <Link>{path && ` >> ${path}`}</Link>
            ))} */}
          <Tabs defaultSelectedTabIndex={0} label="Project Index Config">
            <Tab title="Fields">
              <ExtendedMappingEditor graphqlField={graphqlField} />
            </Tab>
            <Tab title="Aggs panel">
              <AggsStateEditor />
            </Tab>
            <Tab title="Table">
              <ColumnsStateEditor />
            </Tab>
            <Tab title="Matchbox">
              <MatchboxStateEditor />
            </Tab>
          </Tabs>
        </div>
      )}
    </Component>
  );
};

export default compose<IInjectedProps, IExternalProps>(
  withProjectDataGetter,
  reduxContainer,
)(Dashboard);
