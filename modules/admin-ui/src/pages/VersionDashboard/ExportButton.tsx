import * as React from 'react';
import * as JSZip from 'jszip';
import saveAs from 'file-saver';
import { Query } from 'react-apollo';
import Button from 'mineral-ui/Button';

import { CONFIG_FILENAMES } from './AddProjectForm/utils';
import {
  QUERY as ALL_PROJECT_DATA_QUERY,
  IGqlData,
} from 'src/gql/queries/allProjectData';

const download = (content: IGqlData) => {
  return new Promise(resolve => {
    const { project } = content;
    const zip = new JSZip();
    const rootName = `arranger-project-${project.id}`;
    const rootFolder = zip.folder(rootName);
    project.indices.forEach(index => {
      const indexFolder = rootFolder.folder(index.esIndex);
      indexFolder.file(
        CONFIG_FILENAMES.aggsState,
        JSON.stringify(index.aggsState.state, null, 2),
      );
      indexFolder.file(
        CONFIG_FILENAMES.columnsState,
        JSON.stringify(index.columnsState.state, null, 2),
      );
      indexFolder.file(
        CONFIG_FILENAMES.extended,
        JSON.stringify(index.extended, null, 2),
      );
      indexFolder.file(
        CONFIG_FILENAMES.matchboxState,
        JSON.stringify(index.matchBoxState.state, null, 2),
      );
    });
    zip.generateAsync({ type: 'blob' }).then(content => {
      saveAs(content, `${rootName}.zip`);
      resolve();
    });
  });
};

const ExportButton: React.ComponentType<{ projectId: string }> = ({
  projectId,
}) => {
  return (
    <Query
      query={ALL_PROJECT_DATA_QUERY}
      variables={{ projectId }}
      fetchPolicy={'no-cache'}
    >
      {({ data, loading, error }) => {
        const onClick = () => {
          return download(data);
        };
        return (
          <Button size="medium" disabled={loading || error} onClick={onClick}>
            {loading ? 'LOADING...' : 'Export'}
          </Button>
        );
      }}
    </Query>
  );
};

export default ExportButton;
