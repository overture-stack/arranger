import { extendMapping } from '@arranger/mapping-utils';
import { fetchMappings } from '../utils/fetchMappings';
import mapHits from '../utils/mapHits';
import getIndexPrefix from '../utils/getIndexPrefix';
import initializeExtendedFields from '../utils/initializeExtendedFields';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;
  let { index, name, config: rawConfig = {} } = req.body;

  const esType = req.body.esType && req.body.esType.length ? req.body.esType : index;

  if (!id || !index || !name) {
    return res.json({ error: 'missing fields' });
  }

  // indices must be lower cased
  id = id.toLowerCase();
  index = index.toLowerCase();

  const indexPrefix = getIndexPrefix({ projectId: id, index });
  let arrangerConfig = {
    projectsIndex: {
      index: `arranger-projects-${id}`,
      type: `arranger-projects-${id}`,
    },
  };

  const config = rawConfig.reduce(
    (obj, c) => ({
      ...obj,
      [c.name.replace('.json', '')]: c.content,
    }),
    {},
  );

  try {
    await es.create({
      ...arrangerConfig.projectsIndex,
      refresh: true,
      id: index,
      body: {
        index,
        name,
        esType,
        config,
        active: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.json({ error: error.message });
  }

  let types = [];

  try {
    types = await es.search(arrangerConfig.projectsIndex);
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerConfig.projectsIndex.index,
      });
      return res.json({ types });
    } catch (error) {
      return res.json({ error: error.message });
    }
  }

  let hits = mapHits(types);

  let mappings = await fetchMappings({ es, types: hits });

  if (hits.some((x) => mappings.find((y) => y.index === x.index).mapping)) {
    try {
      await es.indices.create({
        index: indexPrefix,
      });

      let aliases = await es.cat.aliases({ format: 'json' });
      let alias = aliases?.find((x) => x.alias === index)?.index;

      let mappings = await es.indices.getMapping({
        index: alias || index,
        type: esType,
      });

      let mapping = mappings[alias || index].mappings[esType].properties;

      let fields = extendMapping(mapping);

      await initializeExtendedFields({ indexPrefix, config, fields, es });
    } catch (error) {
      console.error(error);
      return res.json({ error: error.message });
    }
  }

  res.json({
    types: hits.map((x) => ({
      ...x,
      mappings: mappings.find((y) => y.index === x.index).mapping,
    })),
    total: types.hits.total,
  });
};
