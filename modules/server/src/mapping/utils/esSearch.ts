import { type SearchClient, type SearchQueryResponse } from '#searchClient/types.js';

export default (esClient: SearchClient) => async (params: SearchQueryResponse) => {
	return await esClient.search(params);
};
