import { fetchMappings } from '../utils/fetchMappings';
import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;
  let { index, name } = req.body;

  if (!id || !index || !name) {
    return res.json({ error: 'missing fields' });
  }

  // indices must be lower cased
  id = id.toLowerCase();
  index = index.toLowerCase();

  let arrangerconfig = {
    projectsIndex: {
      index: `arranger-projects-${id}`,
      type: `arranger-projects-${id}`,
    },
  };

  try {
    await es.create({
      ...arrangerconfig.projectsIndex,
      refresh: true,
      id: index,
      body: {
        index,
        name,
        active: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.json({ error: error.message });
  }

  let types = [];

  try {
    types = await es.search(arrangerconfig.projectsIndex);
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });
      return res.json({ types });
    } catch (error) {
      return res.json({ error: error.message });
    }
    return res.json({ error: error.message });
  }

  let hits = mapHits(types);

  let mappings = await fetchMappings({ es, types: hits });

  res.json({
    types: hits.map(x => ({
      ...x,
      mappings: mappings.find(y => y.index === x.index).mapping,
    })),
    total: types.hits.total,
  });
};
