import { type RequestParams } from '@elastic/elasticsearch';

import { type AllClients } from '#searchClient/index.js';

export default (esClient: AllClients) => async (params: RequestParams.Search) => {
	return esClient.search(params)?.body;
};
