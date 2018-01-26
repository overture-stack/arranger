export default async (req, res) => {
  let { es } = req.context;

  let projects = [];

  let arrangerconfig = {
    projectsIndex: {
      index: 'arranger-projects',
      type: 'arranger-projects',
      size: 1000,
    },
  };

  try {
    projects = await es.search(arrangerconfig.projectsIndex);
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });
      res.json({ projects });
    } catch (error) {
      return res.json({ error: error.message });
    }
    return res.json({ error: error.message });
  }

  res.json({
    projects: projects.hits.hits.map(x => x._source),
    total: projects.hits.total,
  });
};
