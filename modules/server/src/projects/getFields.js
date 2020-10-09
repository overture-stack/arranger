import { extendFields, extendMapping, loadExtendedFields } from '@arranger/mapping-utils';

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

  try {
    const fields = await loadExtendedFields({ projectId: id, index, es });
    res.json({
      fields: extendFields(fields),
      total: fields.length,
    });
  } catch (error) {
    try {
      const arrangerConfig = {
        projectsIndex: {
          index: indexPrefix,
          type: indexPrefix,
        },
      };
      await es.indices.create({
        index: arrangerConfig.projectsIndex.index,
      });

      const projectInfoIndex = `arranger-projects-${id}`;
      const projectInfo = await es.search({
        index: projectInfoIndex,
        type: projectInfoIndex,
      });
      const { esType, config } =
        projectInfo?.hits?.hits?.find((x) => x._id === index)?._source || {};

      let aliases = await es.cat.aliases({ format: 'json' });
      let alias = aliases?.find((x) => x.alias === index)?.index;

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
};
