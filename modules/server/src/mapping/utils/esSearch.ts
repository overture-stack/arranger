import { Client, RequestParams } from '@elastic/elasticsearch';

export default (esClient: Client) => async (params: RequestParams.Search) => {
	return (await esClient?.search(params))?.body;
};
