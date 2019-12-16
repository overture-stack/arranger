import * as React from 'react';
import { compose } from 'recompose';
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

import { ILayoutProps, INewIndexInput, IExternalProps } from './types';
import Alert from 'src/components/Alert';
import { getFileContentCollection } from './utils';
import withLocalFormState from './localState';
import withAddProjectMutation from './graphqlService';

const StyledCard = styled(Card)`
  width: 1000px;
  max-width: 100%;
  position: relative;
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
        setIndexMutationInput,
        setIndexConfig,
        removeIndex,
        setError,
        setLoadingState,
      },
      state: { projectId, indices, error, isloading },
    },
    onCancel,
    addProject,
    onProjectAdded,
  } = props;

  const onProjectIdInputChange = (e: React.SyntheticEvent<HTMLInputElement>) =>
    setProjectId(e.currentTarget.value);

  const onSubmit = async () => {
    try {
      setLoadingState(true);
      await addProject({
        projectId,
        indexConfigs: indices,
      });
      onProjectAdded();
    } catch (err) {
      setLoadingState(false);
      setError(err);
    }
  };

  const onIndexAddClick = () =>
    addIndex({
      newIndexMutationInput: {
        projectId,
        graphqlField: '',
        esIndex: '',
      },
      config: null,
    });

  const onIndexGraphqlFieldChange = (arg: IIndexConfigArgs) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setIndexMutationInput(arg.position)({
      ...arg.index,
      graphqlField: e.currentTarget.value,
    });

  const onIndexEsIndexChange = (arg: IIndexConfigArgs) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setIndexMutationInput(arg.position)({
      ...arg.index,
      esIndex: e.currentTarget.value,
    });

  const onFileUpload = ({ position }: { position: number }) => async (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) => {
    const files = e.currentTarget.files;
    if (files) {
      try {
        const filesCollection = await getFileContentCollection(files);
        return setIndexConfig(position)(filesCollection);
      } catch (err) {
        setIndexConfig(position)(null);
        setError(err);
      }
    }
    return;
  };

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
          label="Project ID"
          caption="unique ID to identify this project"
          size="medium"
          disabled={isloading}
          required={!projectId.length}
          input={TextInput}
          value={projectId}
          onChange={onProjectIdInputChange}
        />
        {indices.map((index, position) => (
          <React.Fragment key={position}>
            <CardDivider />
            <Grid alignItems="center" columns={12}>
              <GridItem span={4}>
                <FormField
                  label="Name"
                  caption="Arranger alias for the elasticsearch index"
                  size="medium"
                  disabled={isloading}
                  required={!index.newIndexMutationInput.graphqlField.length}
                  input={TextInput}
                  value={index.newIndexMutationInput.graphqlField}
                  onChange={onIndexGraphqlFieldChange({
                    position,
                    index: index.newIndexMutationInput,
                  })}
                />
              </GridItem>
              <GridItem span={4}>
                <FormField
                  label="ES Index"
                  caption="name of index in elasticsearch"
                  size="medium"
                  disabled={isloading}
                  required={!index.newIndexMutationInput.esIndex.length}
                  input={TextInput}
                  value={index.newIndexMutationInput.esIndex}
                  onChange={onIndexEsIndexChange({
                    position,
                    index: index.newIndexMutationInput,
                  })}
                />
              </GridItem>
              <GridItem span={2}>
                <input
                  type="file"
                  onChange={onFileUpload({
                    position,
                  })}
                  multiple={true}
                />
              </GridItem>
              <GridItem span={2}>
                <Button
                  size="medium"
                  variant="danger"
                  onClick={onIndexConfigRemoveClick(position)}
                  disabled={isloading}
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
            <Button
              onClick={onIndexAddClick}
              size="medium"
              disabled={isloading}
            >
              Add Index
            </Button>
          </GridItem>
        </Grid>
        <CardDivider />
        <CardActions>
          <Button onClick={onSubmit} primary={true} disabled={isloading}>
            Add
          </Button>
          <Button onClick={onCancel} disabled={isloading}>
            Cancel
          </Button>
        </CardActions>
      </CardBlock>
    </StyledCard>
  );
};

export default compose<{}, IExternalProps>(
  withLocalFormState,
  withAddProjectMutation,
)(Layout);
