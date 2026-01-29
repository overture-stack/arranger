import { type RequestParams } from '@elastic/elasticsearch';

import { type SearchClientType } from '#searchClient/index.js';

export default (esClient: SearchClientType) => async (params: RequestParams.Search) => {
	return (await esClient?.search(params))?.body;
};
