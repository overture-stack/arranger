import { type RequestParams } from '@elastic/elasticsearch';

import { type SearchClient } from '#searchClient/types.js';

export default (esClient: SearchClient) => async (params: RequestParams.Search) => {
	return await esClient.search(params)?.body;
};
