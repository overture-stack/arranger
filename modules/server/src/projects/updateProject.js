import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;
  let { field, value } = req.body;

  id = id.toLowerCase();

  let projects = [];

  let projectsIndex = {
    index: 'arranger-projects',
    type: 'arranger-projects',
  };

  try {
    await es.update({
      ...projectsIndex,
      id,
      refresh: true,
      body: { doc: { [field]: value } },
    });
  } catch (error) {
    return res.json({ error });
  }

  try {
    projects = await es.search({
      ...projectsIndex,
      size: 1000,
    });
  } catch (error) {
    try {
      await es.indices.create({
        index: projectsIndex.index,
      });
      return res.json({ projects, total: 0 });
    } catch (error) {
      return res.json({ error: error.message });
    }
    return res.json({ error: error.message });
  }

  res.json({ projects: mapHits(projects), total: projects.hits.total });
};
