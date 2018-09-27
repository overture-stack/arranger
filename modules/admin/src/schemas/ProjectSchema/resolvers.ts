import { QueryContext } from '../../index';
import { Client } from 'elasticsearch';
import { GraphQLResolveInfo } from 'graphql';

export const ARRANGER_PROJECT_INDEX = 'arranger-projects';
export const ARRANGER_PROJECT_TYPE = 'arranger-projects';

export interface ProjectQueryInput {
  id: string;
}

export interface ArrangerProject {
  id: string;
  active: boolean;
  timestamp: string;
}

const getArrangerProjects = async (
  es: Client,
): Promise<Array<ArrangerProject>> => {
  const {
    hits: { hits },
  } = await es.search({
    index: ARRANGER_PROJECT_INDEX,
    type: ARRANGER_PROJECT_TYPE,
  });
  return hits.map(({ _source }) => _source as ArrangerProject);
};

// const addArrangerProject = async (es: Client) => (
//   id: string,
// ): Promise<Array<ArrangerProject>> => {
//   const newArrangerProject:ArrangerProject = {
//     id, active: true, timestamp:
//   }
//   es.create({ index: ARRANGER_PROJECT_INDEX, type: ARRANGER_PROJECT_TYPE, id, body:  });
//   return [];
// };

export default {
  Query: {
    projects: async (
      _,
      args,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ): Promise<Array<ArrangerProject>> => {
      return getArrangerProjects(es);
    },
    project: async (
      _,
      { id }: ProjectQueryInput,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ) => {
      const projects = await getArrangerProjects(es);
      return projects.find(({ id: _id }) => id === _id);
    },
  },
  Mutation: {
    newProject: (
      _,
      { id }: ProjectQueryInput,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ) => {
      return {
        id,
      };
    },
    deleteProject: (
      _,
      { id }: ProjectQueryInput,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ) => {
      return {
        id,
      };
    },
  },
};
