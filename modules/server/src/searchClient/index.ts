import { Client as ElasticClient } from '@elastic/elasticsearch';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';

import { ENV_CONFIG } from '#config/index.js';

import type { AllClients, SupportedClientTypes, SupportedClientOptionTypes, SupportedClientOptions } from './types.js';

export const createSearchClient = (
	clientType: SupportedClientTypes,
	clientOptions: SupportedClientOptionTypes,
): AllClients => {
	if (clientType === 'opensearch') {
		// TODO: validate / no use of 'as'
		const options = clientOptions as SupportedClientOptions[typeof clientType];
		return new OpenSearchClient(options);
	} else {
		// TODO: validate / no use of 'as'
		const options = clientOptions as SupportedClientOptions[typeof clientType];
		return new ElasticClient(options);
	}
};

export default async function getSearchClient(options: SupportedClientOptionTypes) {
	const { ES_HOST, SEARCH_CLIENT } = ENV_CONFIG;
	const searchConfig = await (await fetch(ES_HOST)).json();
	const { distribution } = searchConfig.version;
	try {
		if (distribution === 'opensearch' || SEARCH_CLIENT === 'opensearch') {
			return createSearchClient('opensearch', options);
		} else {
			return createSearchClient('elasticsearch', options);
		}
	} catch (error) {
		console.error(error);
		throw new Error(`Error configuring Search Client`);
	}
}
