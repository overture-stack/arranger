import { UserInputError } from 'apollo-server';
import Qew from 'qew'; // TODO: using 0.9.13 because later versions break the async

import { type AllClients } from '#searchClient/index.js';

import { constants } from '../../services/constants.js';
import { getEsMapping } from '../../services/elasticsearch/index.js';
import { serializeToGqlField, timestamp } from '../../services/index.js';
import { createAggsSetState } from '../AggsState/utils.js';
import { createColumnSetState } from '../ColumnsState/utils.js';
import { createExtendedMapping } from '../ExtendedMapping/utils.js';
import { createMatchboxState } from '../MatchboxState/utils.js';
import { getArrangerProjects } from '../ProjectSchema/utils.js';
import { type EsIndexLocation } from '../types.js';

import {
	type I_ProjectIndexMetadataUpdateDoc,
	type IIndexGqlModel,
	type IIndexQueryInput,
	type IIndexRemovalMutationInput,
	type INewIndexInput,
	type IProjectIndexMetadata,
} from './types.js';

const { ARRANGER_PROJECT_INDEX } = constants;

export const getProjectMetadataEsLocation = (
	projectId: string,
): {
	index: string;
} => ({
	index: `${ARRANGER_PROJECT_INDEX}-${projectId}`,
});

const mappingExistsOn =
	(es: AllClients) =>
	async ({ esIndex }: EsIndexLocation): Promise<boolean> => {
		try {
			await getEsMapping(es)({ esIndex });
			return true;
		} catch (err) {
			return false;
		}
	};

export const getProjectStorageMetadata =
	(es: AllClients) =>
	async (projectId: string): Promise<IProjectIndexMetadata[]> => {
		try {
			const {
				body: {
					hits: { hits },
				},
			} = await es.search({
				...getProjectMetadataEsLocation(projectId),
			});
			return hits.map(({ _source }) => _source as IProjectIndexMetadata);
		} catch (err) {
			throw new UserInputError(`cannot find project of id ${projectId}`, err);
		}
	};

export const getProjectMetadata =
	(es: AllClients) =>
	async (projectId: string): Promise<IIndexGqlModel[]> =>
		Promise.all(
			(await getProjectStorageMetadata(es)(projectId)).map(async (metadata) => ({
				id: `${projectId}::${metadata.name}`,
				hasMapping: mappingExistsOn(es)({
					esIndex: metadata.index,
				}),
				graphqlField: metadata.name,
				projectId: projectId,
				esIndex: metadata.index,
			})),
		);

export const getProjectIndex =
	(es: AllClients) =>
	async ({ projectId, graphqlField }: IIndexQueryInput): Promise<IIndexGqlModel> => {
		try {
			const output = (await getProjectMetadata(es)(projectId)).find(
				({ graphqlField: _graphqlField }) => graphqlField === _graphqlField,
			);
			return output;
		} catch {
			throw new UserInputError(`could not find index ${graphqlField} of project ${projectId}`);
		}
	};

export const createNewIndex =
	(es: AllClients) =>
	async (args: INewIndexInput): Promise<IIndexGqlModel> => {
		const { projectId, graphqlField, esIndex } = args;
		const arrangerProject = (await getArrangerProjects(es)).find((project) => project.id === projectId);
		if (arrangerProject) {
			const serializedGqlField = serializeToGqlField(graphqlField);

			const extendedMapping = await createExtendedMapping(es)({
				esIndex,
			});

			const metadataContent: IProjectIndexMetadata = {
				index: esIndex,
				name: serializedGqlField,
				timestamp: timestamp(),
				active: true,
				config: {
					'aggs-state': await createAggsSetState(es)({ esIndex }),
					'columns-state': await createColumnSetState(es)(
						{
							esIndex,
						},
						graphqlField,
					),
					'matchbox-state': createMatchboxState({
						graphqlField,
						extendedFields: extendedMapping,
					}),
					extended: extendedMapping,
				},
			};

			await es.create({
				...getProjectMetadataEsLocation(projectId),
				id: esIndex,
				body: metadataContent,
				refresh: 'true',
			});

			return getProjectIndex(es)({
				projectId,
				graphqlField: serializedGqlField,
			});
		} else {
			throw new UserInputError(`no project with ID ${projectId} was found`);
		}
	};

// because different metadata entities write to the same ES document, update operations need to be queued up to a single concurrency controlled task queue for each project. This factory creates a task queue manager for this purpose.
const createProjectQueueManager = () => {
	const queues: Record<string, any> = {};
	return {
		getQueue: (projectId: string) => {
			if (!queues[projectId]) {
				queues[projectId] = new Qew();
			}
			return queues[projectId];
		},
	};
};

// pretty bad, since we're just taking anything right now in run time, but at least graphQl will ensure `metaData` is typed in runtime
const projectQueueManager = createProjectQueueManager();
export const updateProjectIndexMetadata =
	(es: AllClients) =>
	async ({
		projectId,
		metaData,
	}: {
		projectId: string;
		metaData: I_ProjectIndexMetadataUpdateDoc;
	}): Promise<IProjectIndexMetadata> => {
		const queue = projectQueueManager.getQueue(projectId);

		return queue.pushProm(async () => {
			await es.update({
				...getProjectMetadataEsLocation(projectId),
				id: metaData.index,
				body: {
					doc: metaData,
				},
				refresh: 'true',
			});

			const output = (await getProjectStorageMetadata(es)(projectId)).find((i) => i.name === metaData.name);

			return output;
		});
	};

export const removeProjectIndex =
	(es: AllClients) =>
	async ({ projectId, graphqlField }: IIndexRemovalMutationInput): Promise<IIndexGqlModel> => {
		try {
			const removedIndexMetadata = await getProjectIndex(es)({
				projectId,
				graphqlField,
			});
			await es.delete({
				...getProjectMetadataEsLocation(projectId),
				id: removedIndexMetadata.esIndex as string,
				refresh: 'true',
			});
			return removedIndexMetadata;
		} catch (err) {
			throw new UserInputError(`could not remove index ${graphqlField} of project ${projectId}`);
		}
	};
