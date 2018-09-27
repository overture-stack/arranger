import { QueryContext } from '../../index';
import { GraphQLResolveInfo } from 'graphql';
import {
  getArrangerProjects,
  addArrangerProject,
  removeArrangerProject,
  IProjectQueryInput,
  IArrangerProject,
} from './utils';

export default {
  Query: {
    projects: async (
      _,
      args,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ): Promise<Array<IArrangerProject>> => {
      return getArrangerProjects(es);
    },
    project: async (
      _,
      { id }: IProjectQueryInput,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ): Promise<IArrangerProject> => {
      const projects = await getArrangerProjects(es);
      return projects.find(({ id: _id }) => id === _id);
    },
  },
  Mutation: {
    newProject: async (
      _,
      { id }: IProjectQueryInput,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ): Promise<IArrangerProject> => {
      return addArrangerProject(es)(id).catch((err: Error) => {
        err.message = 'potential project ID conflict';
        return Promise.reject(err);
      });
    },
    deleteProject: async (
      _,
      { id }: IProjectQueryInput,
      { es }: QueryContext,
      info: GraphQLResolveInfo,
    ) => {
      return removeArrangerProject(es)(id);
    },
  },
};
