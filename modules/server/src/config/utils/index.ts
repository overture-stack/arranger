import { Client } from '@elastic/elasticsearch';

import { CONSTANTS } from '../../middleware';
import { setsMapping } from '../../schema';

export const initializeSets = async ({ esClient }: { esClient: Client }): Promise<void> => {
  if (
    (await esClient.indices.exists({ index: CONSTANTS.ES_ARRANGER_SET_INDEX }))?.statusCode === 404
  ) {
    (
      await esClient.indices.create({
        index: CONSTANTS.ES_ARRANGER_SET_INDEX,
        body: {
          mappings: {
            properties: setsMapping,
          },
        },
      })
    )?.statusCode !== 200 || new Error(`Problem creating ${CONSTANTS.ES_ARRANGER_SET_INDEX} index`);
  }
};
