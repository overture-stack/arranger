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
import { getFileContentCollection } from './utils';

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
        setIndexMutationInput,
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
      newIndexMutationInput: {
        projectId,
        graphqlField: '',
        esIndex: '',
        esType: '',
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

  const onIndexEsTypeChange = (arg: IIndexConfigArgs) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setIndexMutationInput(arg.position)({
      ...arg.index,
      esType: e.currentTarget.value,
    });

  const onFileUpload = ({ position }: { position: number }) => async (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) => {
    const files = e.currentTarget.files;
    if (files) {
      try {
        const filesCollection = await getFileContentCollection(files);
        return filesCollection;
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
            <Grid alignItems="center" columns={12}>
              <GridItem span={3}>
                <FormField
                  required={!index.newIndexMutationInput.graphqlField.length}
                  input={TextInput}
                  label="Name (aka. Graphql Field)"
                  size="medium"
                  value={index.newIndexMutationInput.graphqlField}
                  onChange={onIndexGraphqlFieldChange({
                    position,
                    index: index.newIndexMutationInput,
                  })}
                />
              </GridItem>
              <GridItem span={3}>
                <FormField
                  required={!index.newIndexMutationInput.esIndex.length}
                  input={TextInput}
                  label="ES Index"
                  size="medium"
                  value={index.newIndexMutationInput.esIndex}
                  onChange={onIndexEsIndexChange({
                    position,
                    index: index.newIndexMutationInput,
                  })}
                />
              </GridItem>
              <GridItem span={3}>
                <FormField
                  required={!index.newIndexMutationInput.esType.length}
                  input={TextInput}
                  label="ES type"
                  size="medium"
                  value={index.newIndexMutationInput.esType}
                  onChange={onIndexEsTypeChange({
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
              <GridItem span={1}>
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
