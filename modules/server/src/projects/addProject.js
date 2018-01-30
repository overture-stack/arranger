import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.body;

  if (!id) return res.json({ error: 'id cannot be empty' });

  // indices must be lower cased
  id = id.toLowerCase();

  let projects = [];

  let arrangerconfig = {
    projectsIndex: {
      index: 'arranger-projects',
      type: 'arranger-projects',
    },
  };

  try {
    await es.create({
      ...arrangerconfig.projectsIndex,
      refresh: true,
      id,
      body: {
        id,
        active: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.json({ error: error.message });
  }

  try {
    projects = await es.search({
      ...arrangerconfig.projectsIndex,
      size: 1000,
    });
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });
      return res.json({ projects });
    } catch (error) {
      return res.json({ error: error.message });
    }
    return res.json({ error: error.message });
  }

  res.json({ projects: mapHits(projects), total: projects.hits.total });
};
