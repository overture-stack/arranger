// @ts-check

import getIndexPrefix from './getIndexPrefix';
import mapHits from './mapHits';
import { get } from 'lodash';

export default async ({ projectId, index, es }) => {
  const id = projectId.toLowerCase();
  const lowerCaseIndex = index.toLowerCase();
  const indexPrefix = getIndexPrefix({ projectId: id, index: lowerCaseIndex });
  try {
    const { hits: { total } } = await es.search({
      index: indexPrefix,
      type: indexPrefix,
      size: 0,
      _source: false,
    });
    const fields = mapHits(
      await es.search({
        index: indexPrefix,
        type: indexPrefix,
        size: total,
      }),
    );
    return fields;
  } catch (err) {
    const metaData = await es.search({
      index: `arranger-projects-${projectId}`,
      type: `arranger-projects-${projectId}`,
    });
    const projectIndexData = get(metaData, 'hits.hits').find(
      ({ _source }) => _source.index === index,
    )._source;
    return projectIndexData.config['extended'];
  }
};
