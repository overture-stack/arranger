import { Client, type RequestParams } from '@elastic/elasticsearch';

export default (esClient: Client) => async (params: RequestParams.Search) => (await esClient?.search(params))?.body;
