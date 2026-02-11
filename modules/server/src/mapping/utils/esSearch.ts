import { type RequestParams } from '@elastic/elasticsearch';

import { type SearchClient } from '#searchClient/index.js';

export default (esClient: SearchClient) => async (params: RequestParams.Search) => {
	return esClient.search(params)?.body;
};
