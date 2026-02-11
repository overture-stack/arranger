import type { Client as ElasticClient, ClientOptions as ESClientOptions } from '@elastic/elasticsearch';
import type { Client as OpenSearchClient, ClientOptions as OSClientOptions } from '@opensearch-project/opensearch';

import { type createSearchClient } from './index.js';

export type AllClients = ElasticClient | OpenSearchClient;
export type SearchClient = ReturnType<typeof createSearchClient>;
export type SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
export type SupportedClientOptions = { elasticsearch: ESClientOptions; opensearch: OSClientOptions };
export type SupportedClientTypes = keyof SupportedClients;
export type SupportedClientOptionTypes = SupportedClientOptions[keyof SupportedClientOptions];
