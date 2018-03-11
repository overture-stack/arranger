import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;

  let projects = [];

  let arrangerconfig = {
    projectsIndex: {
      indwex: 'arranger-projects',
      type: 'arranger-projects',
      size: 1000,
    },
  };

  console.log('chamon', es);

  try {
    projects = await es.search(arrangerconfig.projectsIndex);
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });
      return res.json({ projects });
    } catch (error) {
      return res.json({ error: error.message });
    }
  }

  return res.json({
    projects: mapHits(projects),
    total: projects.hits.total,
  });
};
