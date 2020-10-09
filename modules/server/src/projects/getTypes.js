import { fetchMappings } from '../utils/fetchMappings';
import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  // indices must be lower cased
  id = id.toLowerCase();

  let arrangerconfig = {
    projectsIndex: {
      index: `arranger-projects-${id}`,
      type: `arranger-projects-${id}`,
    },
  };

  let types = [];

  try {
    types = await es.search(arrangerconfig.projectsIndex);
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });
      return res.json({ types, total: 0 });
    } catch (error) {
      return res.json({ error: error.message });
    }
    return res.json({ error: error.message });
  }

  let hits = mapHits(types);

  let mappings = await fetchMappings({ es, types: hits });

  res.json({
    types: hits.map((x) => ({
      ...x,
      mappings: mappings.find((y) => y.index === x.index).mapping,
    })),
    total: types.hits.total,
  });
};
