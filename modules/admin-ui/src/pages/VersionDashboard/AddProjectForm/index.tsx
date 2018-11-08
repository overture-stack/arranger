import { compose } from 'recompose';

import { IExternalProps } from './types';
import withLocalFormState from './localState';
import withAddProjectMutation from './graphqlService';

import * as React from 'react';
import styled from 'react-emotion';
import Card, {
  CardBlock,
  CardTitle,
  CardActions,
  CardDivider,
} from 'mineral-ui/Card';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Button from 'mineral-ui/Button';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Text from 'mineral-ui/Text';
import { ILayoutProps, INewIndexInput } from './types';
import Alert from 'src/components/Alert';

const StyledCard = styled(Card)`
  width: 1000px;
  max-width: 100%;
`;

interface IIndexConfigArgs {
  position: number;
  index: INewIndexInput;
}

const Layout: React.ComponentType<ILayoutProps> = props => {
  const {
    formState: {
      mutations: {
        setProjectId,
        addIndex,
        setIndexConfig,
        removeIndex,
        setError,
      },
      state: { projectId, indices, error },
    },
    onCancel,
    addProject,
  } = props;

  const onProjectIdInputChange = (e: React.SyntheticEvent<HTMLInputElement>) =>
    setProjectId(e.currentTarget.value);

  const onSubmit = async () => {
    try {
      await addProject({
        projectId,
        indexConfigs: indices,
      });
      onCancel();
    } catch (err) {
      setError(err);
    }
  };

  const onIndexAddClick = () =>
    addIndex({
      projectId,
      graphqlField: '',
      esIndex: '',
      esType: '',
    });

  const onIndexGraphqlFieldChange = (arg: IIndexConfigArgs) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setIndexConfig(arg.position)({
      ...arg.index,
      graphqlField: e.currentTarget.value,
    });

  const onIndexEsIndexChange = (arg: IIndexConfigArgs) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setIndexConfig(arg.position)({
      ...arg.index,
      esIndex: e.currentTarget.value,
    });

  const onIndexEsTypeChange = (arg: IIndexConfigArgs) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setIndexConfig(arg.position)({
      ...arg.index,
      esType: e.currentTarget.value,
    });

  const onIndexConfigRemoveClick = (position: number) => () =>
    removeIndex(position);

  return (
    <StyledCard>
      <CardTitle> Project Config </CardTitle>
      {error && (
        <CardBlock>
          <Alert variant="error">
            <Text element="h5">{error.message}</Text>
          </Alert>
        </CardBlock>
      )}
      <CardBlock>
        <FormField
          required={!projectId.length}
          input={TextInput}
          label="Project ID"
          size="medium"
          value={projectId}
          onChange={onProjectIdInputChange}
        />
        {indices.map((index, position) => (
          <React.Fragment key={position}>
            <CardDivider />
            <Grid alignItems="center">
              <GridItem>
                <FormField
                  required={!index.graphqlField.length}
                  input={TextInput}
                  label="Name (aka. Graphql Field)"
                  size="medium"
                  value={index.graphqlField}
                  onChange={onIndexGraphqlFieldChange({ position, index })}
                />
              </GridItem>
              <GridItem>
                <FormField
                  required={!index.esIndex.length}
                  input={TextInput}
                  label="ES Index"
                  size="medium"
                  value={index.esIndex}
                  onChange={onIndexEsIndexChange({ position, index })}
                />
              </GridItem>
              <GridItem>
                <FormField
                  required={!index.esType.length}
                  input={TextInput}
                  label="ES type"
                  size="medium"
                  value={index.esType}
                  onChange={onIndexEsTypeChange({ index, position })}
                />
              </GridItem>
              <GridItem>
                <Button
                  size="medium"
                  variant="danger"
                  onClick={onIndexConfigRemoveClick(position)}
                >
                  Remove
                </Button>
              </GridItem>
            </Grid>
          </React.Fragment>
        ))}
        <CardDivider />
        <Grid>
          <GridItem>
            <Button onClick={onIndexAddClick} size="medium">
              Add Index
            </Button>
          </GridItem>
        </Grid>
        <CardDivider />
        <CardActions>
          <Button onClick={onSubmit} primary={true}>
            Add
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </CardActions>
      </CardBlock>
    </StyledCard>
  );
};

export default compose<{}, IExternalProps>(
  withLocalFormState,
  withAddProjectMutation,
)(Layout);
