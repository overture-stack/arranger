import { sortBy } from 'ramda';

import { mappingToAggsState } from '../../../mapping/index.js';
import { type SearchClientType } from '../../../searchClient/index.js';
import { getEsMapping } from '../../services/elasticsearch/index.js';
import { timestamp } from '../../services/index.js';
import { getProjectStorageMetadata, updateProjectIndexMetadata } from '../IndexSchema/utils.js';
import { type EsIndexLocation } from '../types.js';

import {
	type I_AggsSetState,
	type I_AggsState,
	type I_AggsStateQueryInput,
	type I_SaveAggsStateMutationInput,
} from './types.js';

export const createAggsSetState =
	(es: SearchClientType) =>
	async ({ esIndex }: EsIndexLocation): Promise<I_AggsSetState> => {
		const rawEsmapping = await getEsMapping(es)({ esIndex });
		const mapping = rawEsmapping[Object.keys(rawEsmapping)[0]].mappings.properties;
		const aggsState: I_AggsState[] = mappingToAggsState(mapping);
		return { timestamp: timestamp(), state: aggsState };
	};

export const getAggsSetState =
	(es: SearchClientType) =>
	async (args: I_AggsStateQueryInput): Promise<I_AggsSetState> => {
		const { projectId, graphqlField } = args;
		const metaData = (await getProjectStorageMetadata(es)(projectId)).find((entry) => entry.name === graphqlField);
		return metaData.config['aggs-state'];
	};

export const saveAggsSetState =
	(es: SearchClientType) =>
	async (args: I_SaveAggsStateMutationInput): Promise<I_AggsSetState> => {
		const { graphqlField, projectId, state } = args;
		const currentMetadata = (await getProjectStorageMetadata(es)(projectId)).find((i) => i.name === graphqlField);
		const currentAggsState = currentMetadata.config['aggs-state'];
		const sortByNewOrder = sortBy((i: I_AggsState) => state.findIndex((_i) => _i.field === i.field));
		const newAggsSetState: typeof currentAggsState = {
			timestamp: timestamp(),
			state: sortByNewOrder(
				currentAggsState.state.map((item) => ({
					...(state.find((_item) => _item.field === item.field) || item),
					type: item.type,
				})),
			),
		};

		await updateProjectIndexMetadata(es)({
			projectId,
			metaData: {
				index: currentMetadata.index,
				name: currentMetadata.name,
				config: {
					'aggs-state': newAggsSetState,
				},
			},
		});

		return newAggsSetState;
	};
