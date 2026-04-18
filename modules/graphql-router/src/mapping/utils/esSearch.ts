import { type SearchClient, type SearchResponse } from '#searchClient/types.js';

export default (esClient: SearchClient) => async (params: SearchResponse) => {
	return await esClient.search(params);
};
