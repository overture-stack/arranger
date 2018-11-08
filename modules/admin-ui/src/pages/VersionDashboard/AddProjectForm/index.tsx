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

const CONFIG_FILENAMES: {
  aggsState: string;
  columnsState: string;
  extended: string;
  matchboxState: string;
} = {
  aggsState: 'aggs-state.json',
  columnsState: 'columns-state.json',
  extended: 'extended.json',
  matchboxState: 'matchbox-state.json',
};

const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = function(evt: any) {
      resolve(evt.target.result);
    };
    reader.onerror = function(evt) {
      reject();
    };
  });

const extractAndValidate = (files: FileList) => {
  const fileNames = Array.prototype.map.call(files, (file: File) => {
    return file.name;
  }) as string[];
  const allValidNames =
    fileNames.filter(name => Object.values(CONFIG_FILENAMES).includes(name))
      .length === fileNames.length;
  if (!allValidNames) {
    throw new Error(
      `File name must be one of: ${Object.values(CONFIG_FILENAMES).join(', ')}`,
    );
  }
  return fileNames;
};

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
        const fileNames = extractAndValidate(files);
        const fileContents = await Promise.all(Array.prototype.map.call(
          files,
          readFile,
        ) as Array<Promise<string>>);
        const dataContents = fileContents.map(s => JSON.parse(s));
        files[0].name;
        const filesCollection = fileNames.reduce(
          (acc, name, i) => ({ ...acc, [name]: dataContents[i] }),
          {},
        );
        console.log('filesCollection: ', filesCollection);
      } catch (err) {
        setIndexConfig(position)(null);
        setError(err);
      }
    }
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
