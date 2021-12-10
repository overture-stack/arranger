import mapHits from './mapHits';
import { get } from 'lodash';
import esSearch from './esSearch';

export default async ({ esClient, index }) => {
  try {
    const {
      hits: { total },
    } = await esSearch(esClient)({
      index,
      size: 0,
      _source: false,
    });
    const fields = mapHits(
      await esSearch(esClient)({
        index,
        size: total,
      }),
    );
    return fields;
  } catch (err) {
    const metaData = await esSearch(esClient)({ index });
    const indexData = get(metaData, 'hits.hits')?.find(({ _index }) => _index === index)?._source;

    return indexData?.config?.['extended'];
  }
};
