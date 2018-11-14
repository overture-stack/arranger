import gql from 'graphql-tag';
import { Static } from 'runtypes';
import {
  RT_ExtendedMapping,
  RT_AggsState,
  RT_ColumnsState,
  RT_MatchboxState,
} from 'src/pages/VersionDashboard/AddProjectForm/types';

export const QUERY = gql`
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

export interface IGqlProjectIndexMetadata {
  id: string;
  hasMapping: boolean;
  graphqlField: string;
  projectId: string;
  esIndex: string;
  esType: string;

  extended: Static<typeof RT_ExtendedMapping>;

  aggsState: {
    timestamp: string;
    state: Static<typeof RT_AggsState>;
  };
  columnsState: {
    timestamp: string;
    state: Static<typeof RT_ColumnsState>;
  };
  matchBoxState: {
    timestamp: string;
    state: Static<typeof RT_MatchboxState>;
  };
}

export interface IGqlData {
  project: {
    id: string;
    indices: Array<IGqlProjectIndexMetadata>;
  };
}
