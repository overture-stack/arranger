import * as React from 'react';
import { compose } from 'recompose';
import Component from 'react-component-component';
import withAddProjectMutation from './VersionDashboard/AddProjectForm/graphqlService';
import Button from 'mineral-ui/Button';
import ButtonGroup from 'mineral-ui/ButtonGroup';
// import { Link as RouterLink } from 'react-router-dom';

export default compose(withAddProjectMutation)(() => {
  interface ILocalState {
    isCanceling: boolean;
    isSaving: boolean;
  }
  const intialState: ILocalState = {
    isCanceling: false,
    isSaving: false,
  };

  return (
    <Component initialState={intialState}>
      {() => (
        <ButtonGroup size="medium">
          <Button primary={true} size="medium">
            Save Project
          </Button>
          <Button>Cancel</Button>
        </ButtonGroup>
      )}
    </Component>
  );
});
