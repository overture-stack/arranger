import { type Resolver } from '../types.js';

import { type IArrangerProject, type IProjectQueryInput } from './types.js';
import { addArrangerProject, getArrangerProjects, removeArrangerProject } from './utils.js';

const projectsQueryResolver: Resolver<IArrangerProject[]> = async (_, args, { es }, info) =>
	await getArrangerProjects(es);

const singleProjectQueryResolver: Resolver<IArrangerProject, IProjectQueryInput> = async (_, { id }, { es }, info) => {
	const projects = await getArrangerProjects(es);
	return projects.find(({ id: _id }: { id: string }) => id === _id);
};

const newProjectMutationResolver: Resolver<IArrangerProject[], IProjectQueryInput> = async (_, { id }, { es }, info) =>
	addArrangerProject(es)(id).catch((err: Error) => {
		err.message = 'potential project ID conflict';
		return Promise.reject(err);
	});

const deleteProjectMutationResolver: Resolver<IArrangerProject[], IProjectQueryInput> = async (
	_,
	{ id },
	{ es },
	info,
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
