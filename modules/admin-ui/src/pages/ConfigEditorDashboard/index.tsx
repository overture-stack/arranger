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
import Flex, { FlexItem } from 'mineral-ui/Flex';

import ExtendedMappingEditor from './ExtendedMappingEditor';
import AggsStateEditor from './AggsStateEditor';
import ColumnsStateEditor from './ColumnsStateEditor';
import MatchboxStateEditor from './MatchboxStateEditor';
import ProjectActionButtons from '../ProjectActionButtons';

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
        <Flex direction="column">
          <Flex justifyContent="flex-end">
            <ProjectActionButtons />
          </Flex>
          <FlexItem>
            {/* {[projectId, graphqlField].map(path => (
              <Link>{path && ` >> ${path}`}</Link>
            ))} */}
            <Tabs defaultSelectedTabIndex={0} label="Project Index Config">
              <Tab title="Fields">
                <ExtendedMappingEditor graphqlField={graphqlField} />
              </Tab>
              <Tab title="Aggs Panel">
                <AggsStateEditor graphqlField={graphqlField} />
              </Tab>
              <Tab title="Table">
                <ColumnsStateEditor graphqlField={graphqlField} />
              </Tab>
              <Tab title="Quick Search">
                <MatchboxStateEditor graphqlField={graphqlField} />
              </Tab>
            </Tabs>
          </FlexItem>
        </Flex>
      )}
    </Component>
  );
};

export default compose<IInjectedProps, IExternalProps>(
  withProjectDataGetter,
  reduxContainer,
)(Dashboard);
