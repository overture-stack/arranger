import { QueryContext } from '../../index';
import { GraphQLResolveInfo } from 'graphql';
import {
  getArrangerProjects,
  addArrangerProject,
  removeArrangerProject,
  IProjectQueryInput,
  IArrangerProject,
} from './utils';

const projectsQueryResolver = async (
  _,
  args,
  { es }: QueryContext,
  info: GraphQLResolveInfo,
): Promise<Array<IArrangerProject>> => getArrangerProjects(es);

const singleProjectQueryResolver = async (
  _,
  { id }: IProjectQueryInput,
  { es }: QueryContext,
  info: GraphQLResolveInfo,
): Promise<IArrangerProject> => {
  const projects = await getArrangerProjects(es);
  return projects.find(({ id: _id }) => id === _id);
};

const newProjectMutationResolver = async (
  _,
  { id }: IProjectQueryInput,
  { es }: QueryContext,
  info: GraphQLResolveInfo,
): Promise<IArrangerProject> =>
  addArrangerProject(es)(id).catch((err: Error) => {
    err.message = 'potential project ID conflict';
    return Promise.reject(err);
  });

const deleteProjectMutationResolver = async (
  _,
  { id }: IProjectQueryInput,
  { es }: QueryContext,
  info: GraphQLResolveInfo,
) => removeArrangerProject(es)(id);

export const createResolvers = async () => ({
  Query: {
    projects: projectsQueryResolver,
    project: singleProjectQueryResolver,
  },
  Mutation: {
    newProject: newProjectMutationResolver,
    deleteProject: deleteProjectMutationResolver,
  },
});
