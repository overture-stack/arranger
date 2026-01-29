import { Client, type ClientOptions } from '@elastic/elasticsearch';

const SearchClient = (options: ClientOptions) => {
	return new Client(options);
};

export type SearchClientType = ReturnType<typeof SearchClient>;

export default SearchClient;
