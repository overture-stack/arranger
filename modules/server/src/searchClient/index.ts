import { ENV_CONFIG } from '#config/index.js';

import { createElasticSearchClient } from './createElasticSearchClient.js';
import { createOpenSearchClient } from './createOpenSearchClient.js';
import type {
	ArrangerSearchClient,
	SupportedClientTypes,
	SupportedClientOptionTypes,
	SupportedClientOptions,
} from './types.js';

export const createSearchClient = (
	clientType: SupportedClientTypes,
	clientOptions: SupportedClientOptionTypes,
): ArrangerSearchClient => {
	if (clientType === 'opensearch') {
		const options = clientOptions as SupportedClientOptions['opensearch'];
		return createOpenSearchClient(options);
	} else {
		const options = clientOptions as SupportedClientOptions['elasticsearch'];
		return createElasticSearchClient(options);
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
