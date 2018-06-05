import { flattenDeep } from 'lodash';

import { extendFields, extendMapping } from '@arranger/mapping-utils';

import mapHits from '../utils/mapHits';
import getIndexPrefix from '../utils/getIndexPrefix';
import initializeExtendedFields from '../utils/initializeExtendedFields';
import { fetchMapping } from '../utils/fetchMappings';

export default async (req, res) => {
  let { es } = req.context;
  let { id, index } = req.params;

  if (!id || !index) {
    return res.json({ error: 'missing fields' });
  }

  // indices must be lower cased
  id = id.toLowerCase();
  index = index.toLowerCase();
  const indexPrefix = getIndexPrefix({ projectId: id, index });
  let arrangerConfig = {
    projectsIndex: {
      index: indexPrefix,
      type: indexPrefix,
    },
  };

  let fields = [];

  try {
    fields = await es.search({
      index: indexPrefix,
      type: indexPrefix,
      size: 0,
      _source: false,
    });

    fields = await es.search({
      index: indexPrefix,
      type: indexPrefix,
      size: fields.hits.total,
    });
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerConfig.projectsIndex.index,
      });

      const projectInfoIndex = `arranger-projects-${id}`;
      const projectInfo = await es.search({
        index: projectInfoIndex,
        type: projectInfoIndex,
      });
      const { esType, config } =
        projectInfo?.hits?.hits?.find(x => x._id === index)?._source || {};

      let aliases = await es.cat.aliases({ format: 'json' });
      let alias = aliases?.find(x => x.alias === index)?.index;

      const response = await fetchMapping({
        index: alias || index,
        esType,
        es,
      });
      let mappingFields = response ? extendMapping(response.mapping) : [];

      const fields = await initializeExtendedFields({
        indexPrefix,
        fields: mappingFields,
        config,
        es,
      });

      return res.json({ fields, total: fields.length });
    } catch (error) {
      console.error(error);
      return res.json({ error: error.message });
    }
  }

  res.json({
    fields: extendFields(mapHits(fields)),
    total: fields.hits.total,
  });
};
