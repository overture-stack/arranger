import { type SearchClient, type SearchClientSearchParams, type SearchResponse } from '#searchClient/types.js';

export default (esClient: SearchClient) =>
	async (params: SearchClientSearchParams): Promise<SearchResponse> => {
		return await esClient.search(params);
	};
