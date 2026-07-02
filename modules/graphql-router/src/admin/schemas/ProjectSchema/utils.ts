import type { SearchClient } from '../../../searchClient/types.js';
import { constants } from '../../services/constants.js';
import { serializeToEsId } from '../../services/index.js';
import { getProjectMetadataEsLocation } from '../IndexSchema/utils.js';

import type { IArrangerProject } from './types';

const { ARRANGER_PROJECT_INDEX } = constants;

export const newArrangerProject = (id: string): IArrangerProject => ({
	id: serializeToEsId(id),
	active: true,
	timestamp: new Date().toISOString(),
});

export const getArrangerProjects = async (es: SearchClient): Promise<IArrangerProject[]> => {
	const {
		body: {
			hits: { hits },
		},
	} = await es
		.search({
			index: ARRANGER_PROJECT_INDEX,
		})
		.catch(() => ({
			body: {
				hits: {
					hits: [],
				},
			},
		}));
	return hits.map(({ _source }) => _source as IArrangerProject);
};

export const addArrangerProject =
	(es: SearchClient) =>
	async (id: string): Promise<IArrangerProject[]> => {
		//id must be lower case
		const _id = serializeToEsId(id);
		const newProject = newArrangerProject(_id);
		await Promise.all([
			await es.indices.create({ index: getProjectMetadataEsLocation(id).index }),
			await es
				.create({
					index: ARRANGER_PROJECT_INDEX,
					id: _id,
					body: newProject,
					refresh: 'true',
				})
				.then(() => newProject)
				.catch(Promise.reject),
		]);
		return getArrangerProjects(es);
	};

export const removeArrangerProject =
	(es: SearchClient) =>
	async (id: string): Promise<IArrangerProject[]> => {
		const existingProject = (await getArrangerProjects(es)).find(({ id: _id }) => id === _id);
		if (existingProject) {
			await Promise.all([
				es.indices.delete({
					index: getProjectMetadataEsLocation(id).index,
				}),
				es.delete({
					index: ARRANGER_PROJECT_INDEX,
					id: id,
					refresh: 'true',
				}),
			]);
			return getArrangerProjects(es);
		} else {
			return Promise.reject(`No project with id ${id} was found`);
		}
	};
