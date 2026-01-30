import { Client as ElasticClient, type ClientOptions as ESClientOptions } from '@elastic/elasticsearch';
import { Client as OpenSearchClient, type ClientOptions as OSClientOptions } from '@opensearch-project/opensearch';

const SearchClient = (options: ESClientOptions | OSClientOptions) => {
	const clientIsElasticSearch = false;

	if (clientIsElasticSearch) {
		const clientOptions = options as ESClientOptions;
		return new ElasticClient(clientOptions);
	} else {
		const clientOptions = options as OSClientOptions;
		return new OpenSearchClient(clientOptions);
	}
};

export type SearchClientType = ReturnType<typeof SearchClient>;

export default SearchClient;
