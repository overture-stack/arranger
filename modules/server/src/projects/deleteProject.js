import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  if (!id) return res.json({ error: 'id cannot be empty' });

  // indices must be lower cased
  id = id.toLowerCase();

  let arrangerconfig = {
    projectsIndex: {
      index: 'arranger-projects',
      type: 'arranger-projects',
    },
  };

  try {
    await es.delete({
      ...arrangerconfig.projectsIndex,
      refresh: true,
      id,
    });
    await es.indices.delete({
      index: `arranger-projects-${id}*`,
    });
  } catch (error) {
    return res.json({ error: error.message });
  }

  try {
    const projects = await es.search({
      ...arrangerconfig.projectsIndex,
      size: 1000,
    });
    return res.json({
      projects: mapHits(projects),
      total: projects.hits.total,
    });
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });
      return res.json({ projects: [], total: 0 });
    } catch (error) {
      return res.json({ error: error.message });
    }
  }
};
