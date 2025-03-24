import { type RequestEvent } from '@elastic/elasticsearch';

export default (esIndexResponseBody: RequestEvent['body']) =>
	esIndexResponseBody.hits.hits.map((hit: any) => hit?._source);
