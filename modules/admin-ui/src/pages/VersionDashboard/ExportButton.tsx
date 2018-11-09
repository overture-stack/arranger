import * as React from 'react';
import * as JSZip from 'jszip';
import saveAs from 'file-saver';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import Button from 'mineral-ui/Button';
import { Static } from 'runtypes';
import {
  RT_ExtendedMapping,
  RT_AggsState,
  RT_ColumnsState,
  RT_MatchboxState,
} from './AddProjectForm/types';
import { CONFIG_FILENAMES } from './AddProjectForm/utils';

const ALL_DATA_QUERY = gql`
  query($projectId: String!) {
    project(id: $projectId) {
      id
      indices {
        id
        hasMapping
        graphqlField
        projectId
        esIndex
        esType

        extended {
          gqlId
          field
          type
          displayName
          active
          isArray
          primaryKey
          quickSearchEnabled
          unit
          displayValues
          rangeStep
        }
        aggsState {
          timestamp
          state {
            field
            active
            show
          }
        }
        columnsState {
          ... on ColumnsState {
            timestamp
            state {
              type
              keyField
              defaultSorted {
                id
                desc
              }
              columns {
                show
                type
                sortable
                canChangeShow
                query
                jsonPath
                id
                field
                accessor
              }
            }
          }
        }
        matchBoxState {
          timestamp
          state {
            displayName
            field
            isActive
            keyField
            searchFields
          }
        }
      }
    }
  }
`;

interface IGqlData {
  project: {
    id: string;
    indices: Array<{
      id: string;
      hasMapping: boolean;
      graphqlField: string;
      projectId: string;
      esIndex: string;
      esType: string;

      extended: Array<Static<typeof RT_ExtendedMapping>>;

      aggsState: {
        timestamp: string;
        state: Array<Static<typeof RT_AggsState>>;
      };
      columnsState: {
        timestamp: string;
        state: Static<typeof RT_ColumnsState>;
      };
      matchBoxState: {
        timestamp: string;
        state: Array<Static<typeof RT_MatchboxState>>;
      };
    }>;
  };
}

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
      query={ALL_DATA_QUERY}
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
