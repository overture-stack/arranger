import * as React from 'react';
import Component from 'react-component-component';
import Button from 'mineral-ui/Button';
import Text from 'mineral-ui/Text';
import Card, { CardActions, CardBlock, CardDivider } from 'mineral-ui/Card';
import ButtonGroup from 'mineral-ui/ButtonGroup';
import { Link as RouterLink } from 'react-router-dom';

import { ModalOverlay } from 'src/components/Modal';
import ProjectSaveModal from './SaveProjectModal';

export default () => {
  interface ILocalState {
    isCanceling: boolean;
    isSaving: boolean;
  }
  interface IStateContainer {
    state: ILocalState;
    setState: (s: ILocalState) => void;
  }

  const intialState: ILocalState = {
    isCanceling: false,
    isSaving: false,
  };

  const onCancelButtonClick = (s: IStateContainer) => e =>
    s.setState({
      ...s.state,
      isCanceling: true,
      isSaving: false,
    });

  const onSaveButtonClick = (s: IStateContainer) => e =>
    s.setState({
      ...s.state,
      isCanceling: false,
      isSaving: true,
    });

  const closeModals = (s: IStateContainer) => () => {
    s.setState({ ...s.state, isCanceling: false, isSaving: false });
  };

  return (
    <Component initialState={intialState}>
      {(s: IStateContainer) => (
        <>
          <ButtonGroup size="medium">
            <Button primary={true} size="medium" onClick={onSaveButtonClick(s)}>
              Save Project
            </Button>
            <Button onClick={onCancelButtonClick(s)}>Cancel</Button>
          </ButtonGroup>
          {s.state.isSaving && (
            <ModalOverlay>
              <ProjectSaveModal
                onActionCanceled={closeModals(s)}
                onSaveComplete={closeModals(s)}
              />
            </ModalOverlay>
          )}
          {s.state.isCanceling && (
            <ModalOverlay>
              <Card>
                <CardBlock>
                  <Text>All unsaved configuration will be lost.</Text>
                  <Text>Are you sure you want to exit without saving?</Text>
                </CardBlock>
                <CardDivider />
                <CardActions>
                  <Button primary={true} onClick={onSaveButtonClick(s)}>
                    Save
                  </Button>
                  <RouterLink to="/">
                    <Button variant="danger" size="medium" primary={true}>
                      Exit
                    </Button>
                  </RouterLink>
                  <Button onClick={closeModals(s)}>Cancel</Button>
                </CardActions>
              </Card>
            </ModalOverlay>
          )}
        </>
      )}
    </Component>
  );
};
