import { get } from 'lodash';

import esSearch from './esSearch';
import mapHits from './mapHits';

// TODO: this code may be unused

export default async ({ esClient, index }) => {
	try {
		const fields = mapHits(await esSearch(esClient)({ index }));
		return fields;
	} catch (err) {
		const metaData = await esSearch(esClient)({ index });
		const indexData = get(metaData, 'hits.hits')?.find(({ _index }) => _index === index)?._source;

		return indexData?.config?.['extended'];
	}
};
