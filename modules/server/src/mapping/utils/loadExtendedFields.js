// @ts-check

import getIndexPrefix from './getIndexPrefix';
import mapHits from './mapHits';
import { get } from 'lodash';
import esSearch from './esSearch';

export default async ({ projectId, index, es }) => {
  const id = projectId.toLowerCase();
  const lowerCaseIndex = index.toLowerCase();
  const indexPrefix = getIndexPrefix({ projectId: id, index: lowerCaseIndex });
  try {
    const {
      hits: { total },
    } = await esSearch(es)({
      index: indexPrefix,
      size: 0,
      _source: false,
    });
    const fields = mapHits(
      await esSearch(es)({
        index: indexPrefix,
        size: total,
      }),
    );
    return fields;
  } catch (err) {
    const metaData = await esSearch(es)({
      index: `arranger-projects-${projectId}`,
    });
    const projectIndexData = get(metaData, 'hits.hits').find(
      ({ _source }) => _source.index === index,
    )._source;
    return projectIndexData.config['extended'];
  }
};
