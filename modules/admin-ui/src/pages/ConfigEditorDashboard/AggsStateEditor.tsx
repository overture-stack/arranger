import * as React from 'react';
import { connect } from 'react-redux';
import { IGlobalState } from 'src/store';
import { IAggsState } from '../VersionDashboard/AddProjectForm/types';

/***************
 * main component
 ***************/
interface IExternalProps {
  graphqlField: string;
}

interface IReduxStateProps {
  aggsState?: IAggsState;
}

interface IReduxDispatchProps {}

export default connect(
  (state: IGlobalState, { graphqlField }: IExternalProps): IReduxStateProps => {
    if (!state.configEditor.currentProjectData) {
      return {};
    } else {
      const currentProjectIndexData = state.configEditor.currentProjectData.project.indices.find(
        index => index.graphqlField === graphqlField,
      );
      if (currentProjectIndexData) {
        return {
          aggsState: currentProjectIndexData.aggsState.state,
        };
      } else {
        return {};
      }
    }
  },
  (): IReduxDispatchProps => ({}),
)(({ aggsState }: IExternalProps & IReduxStateProps & IReduxDispatchProps) => {
  if (!aggsState) {
    return <div>LOADING...</div>;
  }
  return (
    <div>
      {aggsState.map(agg => (
        <div>
          <div>{agg.field}</div>
        </div>
      ))}
    </div>
  );
});
