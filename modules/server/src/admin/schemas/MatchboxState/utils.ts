import { type SearchClientType } from '#searchClient/index.js';

import { mappingToMatchBoxState as extendedFieldsToMatchBoxState } from '../../../mapping/index.js';
import { replaceBy, timestamp } from '../../services/index.js';
import { type I_GqlExtendedFieldMapping } from '../ExtendedMapping/types.js';
import { getProjectStorageMetadata, updateProjectIndexMetadata } from '../IndexSchema/utils.js';

import {
	type I_MatchBoxField,
	type I_MatchBoxState,
	type I_MatchBoxStateQueryInput,
	type I_SaveMatchBoxStateMutationInput,
} from './types.js';

export const createMatchboxState = ({
	extendedFields,
	graphqlField,
}: {
	extendedFields: I_GqlExtendedFieldMapping[];
	graphqlField: string;
}): I_MatchBoxState => {
	const fields: I_MatchBoxField[] = extendedFieldsToMatchBoxState({
		extendedFields,
		name: graphqlField,
	});
	return { state: fields, timestamp: timestamp() };
};

export const getMatchBoxState =
	(es: SearchClientType) =>
	async ({ graphqlField, projectId }: I_MatchBoxStateQueryInput): Promise<I_MatchBoxState> => {
		const currentMetadata = (await getProjectStorageMetadata(es)(projectId)).find((i) => i.name === graphqlField);
		return currentMetadata?.config['matchbox-state'];
	};

export const saveMatchBoxState =
	(es: SearchClientType) =>
	async ({
		graphqlField,
		projectId,
		state: updatedMatchboxFields,
	}: I_SaveMatchBoxStateMutationInput): Promise<I_MatchBoxState> => {
		const currentMetadata = (await getProjectStorageMetadata(es)(projectId)).find((i) => i.name === graphqlField);
		const currentMatchboxFields = currentMetadata?.config['matchbox-state'].state || [];
		const newMatchboxState: I_MatchBoxState = {
			timestamp: timestamp(),
			state: replaceBy(
				currentMatchboxFields,
				updatedMatchboxFields,
				({ field: field1 }, { field: field2 }) => field1 === field2,
			),
		};

		await updateProjectIndexMetadata(es)({
			projectId,
			metaData: {
				index: currentMetadata?.index,
				name: currentMetadata?.name,
				config: {
					'matchbox-state': newMatchboxState,
				},
			},
		});

		return newMatchboxState;
	};
