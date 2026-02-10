import { Client as ElasticClient, type ClientOptions as ESClientOptions } from '@elastic/elasticsearch';
import { Client as OpenSearchClient, type ClientOptions as OSClientOptions } from '@opensearch-project/opensearch';

import { ENV_CONFIG } from '#config/index.js';

export type AllClients = ElasticClient | OpenSearchClient;
type Clients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
type ClientTypes = keyof Clients;
type ClientOptions = { elasticsearch: ESClientOptions; opensearch: OSClientOptions };

async function getSearchClient<Key extends ClientTypes>(options: ClientOptions[Key]) {
	const { ES_HOST } = ENV_CONFIG;
	const searchConfig = await (await fetch(ES_HOST)).json();
	const { distribution } = searchConfig.version;
	try {
		if (distribution === 'opensearch') {
			const clientOptions = options as OSClientOptions;
			return new OpenSearchClient(clientOptions);
		} else {
			const clientOptions = options as ESClientOptions;
			return new ElasticClient(clientOptions);
		}
	} catch (error) {
		console.error(error);
		throw new Error(`Error configuring Search Client`);
	}
}

export type SearchClientType = ReturnType<typeof getSearchClient>;

export default getSearchClient;
