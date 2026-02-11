import { Client as ElasticClient, type ClientOptions as ESClientOptions } from '@elastic/elasticsearch';
import { Client as OpenSearchClient, type ClientOptions as OSClientOptions } from '@opensearch-project/opensearch';

import { ENV_CONFIG } from '#config/index.js';

export type AllClients = ElasticClient | OpenSearchClient;
export type SearchClient = ReturnType<typeof createSearchClient>;
export type SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
export type SupportedClientOptions = { elasticsearch: ESClientOptions; opensearch: OSClientOptions };
export type SupportedClientTypes = keyof SupportedClients;
export type SupportedClientOptionTypes = SupportedClientOptions[keyof SupportedClientOptions];

const createSearchClient = (
	clientType: SupportedClientTypes,
	clientOptions: SupportedClientOptionTypes,
): AllClients => {
	if (clientType === 'opensearch') {
		// TODO: validate
		const options = clientOptions as SupportedClientOptions[typeof clientType];
		return new OpenSearchClient(options);
	} else {
		// TODO: validate
		const options = clientOptions as SupportedClientOptions[typeof clientType];
		return new ElasticClient(options);
	}
};

async function getSearchClient(options: SupportedClientOptionTypes) {
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

export default getSearchClient;
