import { Client as ElasticClient, type ClientOptions as ESClientOptions } from '@elastic/elasticsearch';
import { Client as OpenSearchClient, type ClientOptions as OSClientOptions } from '@opensearch-project/opensearch';

import { ENV_CONFIG } from '#config/index.js';

const SearchClient = async (options: ESClientOptions | OSClientOptions) => {
	const { ES_HOST } = ENV_CONFIG;
	const searchConfig = await (await fetch(ES_HOST)).json();
	const { distribution } = searchConfig.version;

	if (distribution === 'elasticsearch') {
		const clientOptions = options as ESClientOptions;
		return new ElasticClient(clientOptions);
	} else if (distribution === 'opensearch') {
		const clientOptions = options as OSClientOptions;
		return new OpenSearchClient(clientOptions);
	}
	throw new Error(`Error configuring Search Client with distribution ${distribution}`);
};

export type SearchClientType = ReturnType<typeof SearchClient>;

export default SearchClient;
